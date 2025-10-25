import { Telegraf } from 'telegraf';
import http from 'node:http';

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

async function main(): Promise<void> {
  const bot = await createBot();

  // Start a minimal HTTP health server so hosting providers (Render, etc.)
  // detect an open port. Bind to process.env.PORT when present.
  const port = Number(process.env.PORT ?? 3000);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Health server listening on ${port}`);
  });

  try {
    await bot.launch();
    console.log(`🤖 Bot launched in ${env.NODE_ENV} mode`);

    const gracefulStop = async () => {
      console.log('Stopping bot...');
      await bot.stop('SIGTERM');
      // close the health server gracefully
      await new Promise<void>((resolve) => server.close(() => resolve()));
      process.exit(0);
    };

    process.once('SIGINT', gracefulStop);
    process.once('SIGTERM', gracefulStop);
    return;
  } catch (error: any) {
    const code = error?.response?.error_code;
    if (code === 409) {
      console.error('Failed to start bot: another getUpdates listener is running for this bot (HTTP 409).');
      console.error('Make sure only one instance of the bot is running, or switch to webhooks.');
      process.exit(1);
    }

    // Re-throw unknown errors after logging
    console.error('Failed to launch bot:', error);
    process.exit(1);
  }

}

void main();
