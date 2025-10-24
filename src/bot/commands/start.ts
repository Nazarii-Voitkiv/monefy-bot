import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';

export function registerStartCommand(bot: Telegraf<BotContext>): void {
  bot.start(async (ctx) => {
    const name = ctx.from?.first_name ?? 'друже';
    await ctx.reply(
      [
        `Привіт, ${name}!`,
        'Я допомагаю вести облік витрат і доходів.',
        '',
        'Додавання транзакцій:',
        '`- 45.90 PLN coffee @2025-10-20`',
        '`+ 1200 UAH salary`',
        '',
        'Команди:',
        '/add — інструкція формату',
        '/today, /week, /month — статистика',
        '/stats 2025-10 або /stats 2025-10-01 2025-10-10',
        '/cat add food expense — створити категорію',
        '/cat list — список категорій',
        '/rate 2025-10-23 — курс на дату'
      ].join('\n'),
      { parse_mode: 'Markdown' }
    );
  });
}
