import { desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { categories, transactions } from '../db/schema.js';
import type { CategoryRecord } from './categories.js';
import type { FxRate, FxProvider } from './fxProvider.js';

export interface CreateTransactionArgs {
  tgUserId: string;
  category: CategoryRecord;
  sign: 1 | -1;
  amount: number;
  currency: 'USD' | 'PLN' | 'UAH';
  note: string | null;
  txnDate: Date;
  rateDate: string;
  fxProvider: FxProvider;
}

export interface TransactionRecord {
  id: number;
  tgUserId: string;
  categoryId: number;
  amount: number;
  amountUsd: number;
  sign: 1 | -1;
  currency: 'USD' | 'PLN' | 'UAH';
  note: string | null;
  txnAt: Date;
  rateDate: string;
  isRateApprox: boolean;
}

function convertAmountToUsd(rate: FxRate, amount: number, currency: 'USD' | 'PLN' | 'UAH', sign: 1 | -1): number {
  const base = currency.toLowerCase() as 'usd' | 'pln' | 'uah';
  const divisor = rate[base];
  if (!divisor) {
    throw new Error(`Missing FX rate for ${currency}`);
  }

  const usdValue = (sign * amount) / divisor;
  return Number(usdValue.toFixed(2));
}

function toPgNumeric(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

export async function createTransaction({
  tgUserId,
  category,
  sign,
  amount,
  currency,
  note,
  txnDate,
  rateDate,
  fxProvider
}: CreateTransactionArgs): Promise<TransactionRecord> {
  const fxRate = await fxProvider.getDailyRates(rateDate);
  const amountUsd = convertAmountToUsd(fxRate, amount, currency, sign);

  const [created] = await db
    .insert(transactions)
    .values({
      tgUserId,
      categoryId: category.id,
      sign,
      amount: toPgNumeric(amount),
      currency,
      amountUsd: toPgNumeric(amountUsd),
      note,
      txnAt: txnDate,
      rateDate: fxRate.rateDate,
      isRateApprox: fxRate.isApprox
    })
    .returning({
      id: transactions.id,
      tgUserId: transactions.tgUserId,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      amountUsd: transactions.amountUsd,
      sign: transactions.sign,
      currency: transactions.currency,
      note: transactions.note,
      txnAt: transactions.txnAt,
      rateDate: transactions.rateDate,
      isRateApprox: transactions.isRateApprox
    });

  return {
    ...created,
    amount: Number(created.amount),
    amountUsd: Number(created.amountUsd),
    sign: created.sign as 1 | -1,
    currency: created.currency as 'USD' | 'PLN' | 'UAH'
  };
}

export async function deleteTransactionsForCategory(
  categoryId: number
): Promise<number> {
  const result = await db
    .delete(transactions)
    .where(eq(transactions.categoryId, categoryId));

  return result.rowCount ?? 0;
}

export async function getRecentTransactions(
  tgUserId: string,
  limit = 5
): Promise<TransactionRecord[]> {
  const rows = await db
    .select({
      id: transactions.id,
      tgUserId: transactions.tgUserId,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      amountUsd: transactions.amountUsd,
      sign: transactions.sign,
      currency: transactions.currency,
      note: transactions.note,
      txnAt: transactions.txnAt,
      rateDate: transactions.rateDate,
      isRateApprox: transactions.isRateApprox
    })
    .from(transactions)
    .where(eq(transactions.tgUserId, tgUserId))
    .orderBy(desc(transactions.txnAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    amountUsd: Number(row.amountUsd),
    sign: row.sign as 1 | -1,
    currency: row.currency as 'USD' | 'PLN' | 'UAH'
  }));
}
