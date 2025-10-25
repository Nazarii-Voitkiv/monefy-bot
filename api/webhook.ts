import { createBot } from '../src/bot/index.js';

// Cache the bot instance promise between invocations to avoid re-creating it on every request.
let botPromise: Promise<any> | null = null;

async function getBot() {
  if (!botPromise) {
    // Wrap creation so we can reset the cache on failure and allow retries on subsequent invocations
    botPromise = (async () => {
      try {
        return await createBot();
      } catch (err) {
        // reset cache so next invocation will retry initialization
        botPromise = null;
        throw err;
      }
    })();
  }
  return botPromise;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      // Simple health check that doesn't leak secrets (only presence flags)
      res.status(200).json({
        ok: true,
        env: {
          BOT_TOKEN: !!process.env.BOT_TOKEN,
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const bot = await getBot();
    const t = await import('telegraf');
    const webhookCallback = (t as any).webhookCallback ?? (t.default && (t.default as any).webhookCallback);
    if (!webhookCallback) {
      throw new Error('telegraf.webhookCallback not found');
    }
    const cb = (webhookCallback as any)(bot as any, 'http');

    // Delegate the request to Telegraf's webhook handler.
    return cb(req, res);
  } catch (err: any) {
    // Log full error to Vercel function logs for debugging
    console.error('api/webhook handler error:', err && (err.stack || err));

    // Reset cached bot promise so next invocation will retry initialization
    try {
      botPromise = null;
    } catch (_) {
      // ignore
    }

    // Return a helpful error body for quick remote debugging. This is temporary — remove in production.
    const message = err?.message || String(err) || 'Unknown error';
    res.status(500).json({ error: message, stack: (err?.stack || '').split('\n').slice(0, 20) });
    return;
  }
}
