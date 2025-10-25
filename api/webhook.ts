import { createBot } from '../src/bot/index.js';

let botPromise: Promise<any> | null = null;

async function getBot() {
  if (!botPromise) {
    botPromise = (async () => createBot())();
  }
  return botPromise;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      try {
        const urlHasInit = typeof req.url === 'string' && req.url.includes('init=1');
        if (urlHasInit) {
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

        res.status(200).json({ ok: true });
        return;
      } catch (err) {
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
    let update = (req as any).body;
    if (!update) {
      try {
        const raw = (req as any).rawBody || '';
        update = raw ? JSON.parse(raw) : undefined;
      } catch (parseErr) {
        console.error('Failed to parse raw body for update:', parseErr);
      }
    }

    if (!update) {
      res.status(400).json({ error: 'Missing update body' });
      return;
    }

    try {
      const handler = (bot as any).handleUpdate ?? (bot as any).telegram?.handleUpdate;
      if (typeof handler === 'function') {
        await handler.call(bot, update);
      } else if (typeof (bot as any).handleUpdate === 'function') {
        await (bot as any).handleUpdate(update);
      } else {
        if (typeof (bot as any).processUpdate === 'function') {
          await (bot as any).processUpdate(update);
        } else {
          throw new Error('No update handler found on bot instance');
        }
      }

      res.status(200).send('OK');
      return;
    } catch (handleErr: any) {
      console.error('Error while handling update with bot.handleUpdate:', handleErr && (handleErr.stack || handleErr));
      throw handleErr;
    }
  } catch (err: any) {
    console.error('api/webhook error during handling:', err && (err.stack || err));
    try {
      botPromise = null;
    } catch (_) {}
    res.status(500).json({ error: String(err?.message || err), stack: (err?.stack || '').split('\n').slice(0, 20) });
    return;
  }
}
