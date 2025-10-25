import { differenceInCalendarDays } from 'date-fns';
import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';
import { formatUsd } from '../helpers/format.js';
import {
  buildRangeBetween,
  buildRangeForMonth,
  buildRangeForMonthString,
  buildRangeForToday,
  buildRangeForWeek,
  formatDateLabel,
  formatRangeLabel
} from '../../utils/date.js';
import { getSummaryStats, getCategoryBreakdown } from '../../services/reports.js';

async function replyWithStats(ctx: BotContext, label: string, from: Date, to: Date) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Користувач не знайдений.');
    return;
  }

  const summary = await getSummaryStats(user.tgUserId, { from, to });
  const breakdown = await getCategoryBreakdown(user.tgUserId, { from, to });

  const lines: string[] = [];
  lines.push(`📊 Звіт за ${label}`);
  lines.push('');

  lines.push(`✅ Доходи: ${formatUsd(summary.incomesUsd)}`);
  if (breakdown.incomes.length > 0) {
    const totalIn = summary.incomesUsd || 0;
    breakdown.incomes.forEach((c) => {
      const pct = totalIn > 0 ? (c.total / totalIn) * 100 : 0;
      lines.push(`• ${c.name} — ${formatUsd(c.total)} (${pct.toFixed(1)}%)`);
    });
  } else {
    lines.push('• Немає доходів за період.');
  }

  lines.push('');

  lines.push(`❌ Витрати: ${formatUsd(summary.expensesUsd)}`);
  if (breakdown.expenses.length > 0) {
    const totalOut = summary.expensesUsd || 0;
    breakdown.expenses.forEach((c) => {
      const pct = totalOut > 0 ? (c.total / totalOut) * 100 : 0;
      lines.push(`• ${c.name} — ${formatUsd(c.total)} (${pct.toFixed(1)}%)`);
    });
  } else {
    lines.push('• Немає витрат за період.');
  }

  lines.push('');
  lines.push(`Баланс: ${formatUsd(summary.totalUsd)}`);

  await ctx.reply(lines.join('\n'));
}

function parseStatsArgs(args: string[]): { from: Date; to: Date; label: string } | null {
  if (args.length === 0) {
    return null;
  }

  if (args.length === 1) {
    const value = args[0];
    if (/^\d{4}-\d{2}$/.test(value)) {
      const range = buildRangeForMonthString(value);
      return { ...range, label: value };
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value);
      return { from: date, to: date, label: value };
    }
  }

  if (args.length === 2) {
    const [fromRaw, toRaw] = args;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      const range = buildRangeBetween(fromRaw, toRaw);
      return { ...range, label: formatRangeLabel(range.from, range.to) };
    }
  }

  return null;
}

export function registerStatsCommands(bot: Telegraf<BotContext>): void {
  bot.command('today', async (ctx) => {
    const now = new Date();
    const range = buildRangeForToday(now);
    await replyWithStats(ctx, formatDateLabel(now), range.from, range.to);
  });

  bot.command('week', async (ctx) => {
    const now = new Date();
    const range = buildRangeForWeek(now);
    const label = formatRangeLabel(range.from, range.to);
    await replyWithStats(ctx, label, range.from, range.to);
  });

  bot.command('month', async (ctx) => {
    const now = new Date();
    const range = buildRangeForMonth(now);
    const label = formatDateLabel(range.from).slice(0, 7);
    await replyWithStats(ctx, label, range.from, range.to);
  });

  bot.command('stats', async (ctx) => {
    const messageText = ctx.message?.text ?? '';
    const args = messageText.split(' ').slice(1).filter(Boolean);
    const parsed = parseStatsArgs(args);
    if (!parsed) {
      await ctx.reply('Використання: /stats 2025-10 або /stats 2025-10-01 2025-10-10');
      return;
    }

    if (differenceInCalendarDays(parsed.to, parsed.from) > 365) {
      await ctx.reply('Діапазон не може перевищувати 365 днів.');
      return;
    }

    await replyWithStats(ctx, parsed.label, parsed.from, parsed.to);
  });
}
