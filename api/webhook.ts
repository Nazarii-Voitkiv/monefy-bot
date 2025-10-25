import { createBot } from '../src/bot/index.js';

let botPromise: Promise<any> | null = null;

async function getBot() {
  if (!botPromise) {
    botPromise = createBot();
  }
  return botPromise;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    res.status(200).send('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const bot = await getBot();
  const t = await import('telegraf');
  const cb = (t as any).webhookCallback(bot as any, 'http');
  return cb(req, res);
}
