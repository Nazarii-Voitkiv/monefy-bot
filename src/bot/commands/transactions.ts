import { message } from 'telegraf/filters';

import type { BotContext } from '../context.js';
import { formatCurrency, formatUsd } from '../helpers/format.js';
import { parseTransactionInput, ParseError } from '../helpers/parser.js';
import { requireCategory } from '../../services/categories.js';
import { fxProvider } from '../../services/fxProvider.js';
import { createTransaction } from '../../services/transactions.js';
import { handleTransactionEdit } from './history.js';
import { userState } from '../state.js';

const SIGN_KIND_MAP = {
  1: 'income',
  [-1]: 'expense'
} as const;

export function registerTransactionMessages(bot: import('telegraf').Telegraf<BotContext>): void {
  bot.on(message('text'), async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      return;
    }

    const user = ctx.state.user;
    if (!user) {
      await ctx.reply('Користувач не знайдений.');
      return;
    }

    const currentState = userState.get(user.tgUserId);
    if (currentState && currentState.type !== 'IDLE') {
      await handleTransactionEdit(ctx, currentState, text);
      return;
    }

    try {
      const parsed = parseTransactionInput(text, user.baseCurrency as 'USD' | 'PLN' | 'UAH');
      const categoryKind = SIGN_KIND_MAP[parsed.sign];
      const category = await requireCategory(user.tgUserId, parsed.categoryName, categoryKind);

      const transaction = await createTransaction({
        tgUserId: user.tgUserId,
        category,
        sign: parsed.sign,
        amount: parsed.amount,
        currency: parsed.currency,
        note: parsed.note,
        txnDate: parsed.txnDate,
        rateDate: parsed.rateDate,
        fxProvider
      });

      const replyLines = [
        `${parsed.sign === 1 ? '✅ Дохід' : '💸 Витрата'} ${parsed.sign === 1 ? 'збережений' : 'збережена'}.`,
        `${formatCurrency(parsed.amount * parsed.sign, parsed.currency)} → ${formatUsd(transaction.amountUsd)}`,
        `Категорія: ${category.name}`,
        `Дата: ${parsed.rateDate}`
      ];

      if (parsed.note) {
        replyLines.push(`Нотатка: ${parsed.note}`);
      }

      await ctx.reply(replyLines.join('\n'));
    } catch (error) {
      if (error instanceof ParseError) {
        await ctx.reply(error.message);
        return;
      }

      await ctx.reply(`Помилка: ${(error as Error).message}`);
    }
  });
}
