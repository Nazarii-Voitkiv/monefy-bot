import type { Telegraf } from 'telegraf';

import type { BotContext } from './context';
import { createBot } from './index';

let botPromise: Promise<Telegraf<BotContext>> | null = null;

export async function getBot(): Promise<Telegraf<BotContext>> {
  if (!botPromise) {
    botPromise = createBot();
  }

  return botPromise;
}

export function resetBot(): void {
  botPromise = null;
}
