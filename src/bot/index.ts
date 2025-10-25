import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import type { BotContext } from './context.js';
import { authorizeMiddleware } from './middlewares/authorize.js';
import { ensureUserMiddleware } from './middlewares/ensureUser.js';
import { registerBotCommands } from './commands/index.js';

export async function createBot(): Promise<Telegraf<BotContext>> {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

  bot.use(authorizeMiddleware);
  bot.use(ensureUserMiddleware);
  registerBotCommands(bot);
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Почати роботу з ботом' },
    { command: 'add', description: 'Формат додавання транзакцій' },
    { command: 'today', description: 'Статистика за сьогодні' },
    { command: 'week', description: 'Статистика за поточний тиждень' },
    { command: 'month', description: 'Статистика за поточний місяць' },
    { command: 'stats', description: 'Статистика за діапазон' },
    { command: 'cat', description: 'Керування категоріями' },
    { command: 'rate', description: 'Курс валют на дату' }
  ]);

  bot.catch((error, ctx) => {
    console.error('Bot error', error);
    ctx.reply('Сталася помилка. Спробуй ще раз пізніше.').catch(() => undefined);
  });

  return bot;
}

// For serverless deployments (Vercel) we do NOT auto-run the bot here.
// Instead `createBot()` is exported and the serverless API route will call it
// and use `webhookCallback` to forward updates from Telegram.
// createBot is exported above; do not auto-run main in serverless environments.
