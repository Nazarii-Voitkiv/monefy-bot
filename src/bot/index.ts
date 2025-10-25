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
  try {
    registerBotCommands(bot);
  } catch (err) {
    console.error('Failed to register bot commands:', err);
  }

  try {
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
  } catch (err) {
    console.error('Failed to set bot commands via Telegram API:', err);
  }

  bot.catch((error, ctx) => {
    console.error('Bot error', error);
    ctx.reply('Сталася помилка. Спробуй ще раз пізніше.').catch(() => undefined);
  });

  return bot;
}
