import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import { closeDb } from '../db/client.js';
import type { BotContext } from './context.js';
import { ensureUserMiddleware } from './middlewares/ensureUser.js';
import { registerBotCommands } from './commands/index.js';

export async function createBot(): Promise<Telegraf<BotContext>> {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

  bot.use(ensureUserMiddleware);
  registerBotCommands(bot);

  bot.catch((error, ctx) => {
    console.error('Bot error', error);
    ctx.reply('Сталася помилка. Спробуй ще раз пізніше.').catch(() => undefined);
  });

  return bot;
}

async function main(): Promise<void> {
  const bot = await createBot();

  await bot.launch();
  console.log(`🤖 Bot launched in ${env.NODE_ENV} mode`);

  const gracefulStop = async () => {
    console.log('Stopping bot...');
    await bot.stop('SIGTERM');
    await closeDb();
    process.exit(0);
  };

  process.once('SIGINT', gracefulStop);
  process.once('SIGTERM', gracefulStop);
}

void main();
