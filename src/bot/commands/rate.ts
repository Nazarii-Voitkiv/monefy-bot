import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';
import { fxProvider } from '../../services/fxProvider.js';

export function registerRateCommand(bot: Telegraf<BotContext>): void {
  bot.command('rate', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1) ?? [];
    const date = args[0] && /^\d{4}-\d{2}-\d{2}$/.test(args[0]) ? args[0] : new Date().toISOString().slice(0, 10);

    try {
      const rate = await fxProvider.getDailyRates(date);
      const lines = [
        `Курс USD на ${date}:`,
        `1 USD = ${rate.pln.toFixed(4)} PLN`,
        `1 USD = ${rate.uah.toFixed(4)} UAH`
      ];
      await ctx.reply(lines.join('\n'));
    } catch (error) {
      await ctx.reply(`Не вдалося отримати курс: ${(error as Error).message}`);
    }
  });
}
