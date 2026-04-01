import { Telegraf } from 'telegraf';

import { appBaseUrl, assertProductionEnv, env } from '../config/env';
import { registerBotCommands } from './commands/index';
import type { BotContext } from './context';
import { authorizeMiddleware } from './middlewares/authorize';
import { ensureUserMiddleware } from './middlewares/ensureUser';

export async function createBot(): Promise<Telegraf<BotContext>> {
  assertProductionEnv();

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
      { command: 'rate', description: 'Курс валют на дату' },
      { command: 'history', description: 'Історія транзакцій' }
    ]);

    if (appBaseUrl) {
      await bot.telegram.setChatMenuButton({
        menuButton: {
          text: 'Відкрити дашборд',
          type: 'web_app',
          web_app: { url: appBaseUrl }
        }
      });
    } else {
      await bot.telegram.setChatMenuButton({ menuButton: { type: 'commands' } });
    }

  } catch (err) {
    console.error('Failed to set bot commands via Telegram API:', err);
  }

  bot.catch((error, ctx) => {
    console.error('Bot error', error);
    ctx.reply('Сталася помилка. Спробуй ще раз пізніше.').catch(() => undefined);
  });

  return bot;
}
