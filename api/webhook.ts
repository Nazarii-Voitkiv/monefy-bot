import { createBot } from '../src/bot/index.js';

let botPromise: Promise<any> | null = null;

async function getBot() {
  if (!botPromise) {
    // cache the promise so we don't re-init on every request
    botPromise = (async () => createBot())();
  }
  return botPromise;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      // If caller asks to init the bot, attempt initialization and return any error.
      try {
        const urlHasInit = typeof req.url === 'string' && req.url.includes('init=1');
        if (urlHasInit) {
          // attempt to initialize the bot and return any initialization error
          try {
            await getBot();
            res.status(200).json({ ok: true, initialized: true });
            return;
          } catch (initErr: any) {
            console.error('api/webhook init error:', initErr && (initErr.stack || initErr));
            res.status(500).json({ error: String(initErr?.message || initErr), stack: (initErr?.stack || '').split('\n').slice(0, 20) });
            return;
          }
        }

        // lightweight health check
        res.status(200).json({ ok: true });
        return;
      } catch (err) {
        // shouldn't happen, but guard
        console.error('api/webhook GET handler unexpected error:', err);
        res.status(500).json({ error: String(err) });
        return;
      }
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const bot = await getBot();
    const t = await import('telegraf');
    // telegraf may export webhookCallback as a named export or as a property on the default export depending on bundler/version
    const webhookCallback = (t as any).webhookCallback ?? (t as any).default?.webhookCallback ?? (t as any).Telegraf?.webhookCallback;
    if (!webhookCallback) {
      throw new Error('telegraf.webhookCallback not found');
    }
    const cb = (webhookCallback as any)(bot as any, 'http');
    return cb(req, res);
  } catch (err: any) {
    // log so Vercel shows the stacktrace in function logs
    console.error('api/webhook error during handling:', err && (err.stack || err));
    // reset botPromise to allow retry on next invocation
    try {
      botPromise = null;
    } catch (_) {}
    // return a JSON body to help debugging (temporary)
    res.status(500).json({ error: String(err?.message || err), stack: (err?.stack || '').split('\n').slice(0, 20) });
    return;
  }
}
