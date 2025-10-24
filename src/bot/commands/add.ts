import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';

export function registerAddHelp(bot: Telegraf<BotContext>): void {
  bot.command('add', async (ctx) => {
    await ctx.reply(
      [
        'Формат додавання транзакцій:',
        '`- 45.90 PLN coffee @2025-10-20 нотатка`',
        '`+ 1200 UAH salary бонус`',
        '',
        'Пояснення:',
        '• знак + або - (за замовчуванням витрата)',
        '• сума (дозволені , або .)',
        '• валюта (PLN, UAH, USD) — опц.',
        '• категорія — обовʼязково',
        '• @YYYY-MM-DD — дата (опц., інакше сьогодні)',
        '• нотатка — будь-який текст по завершенні'
      ].join('\n'),
      { parse_mode: 'Markdown' }
    );
  });
}
