import { supabase } from '../db/client.js';
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
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      tg_user_id: tgUserId,
      category_id: category.id,
      sign,
      amount: toPgNumeric(amount),
      currency,
      amount_usd: toPgNumeric(amountUsd),
      note,
      txn_at: txnDate.toISOString(),
      rate_date: fxRate.rateDate,
      is_rate_approx: fxRate.isApprox
    })
    .select(
      'id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx'
    )
    .limit(1);

  if (error) throw error;
  const created = data && data[0];
  return {
    id: created.id,
    tgUserId: created.tg_user_id,
    categoryId: created.category_id,
    amount: Number(created.amount),
    amountUsd: Number(created.amount_usd),
    sign: created.sign as 1 | -1,
    currency: created.currency as 'USD' | 'PLN' | 'UAH',
    note: created.note,
    txnAt: new Date(created.txn_at),
    rateDate: created.rate_date,
    isRateApprox: created.is_rate_approx
  };
}

export async function deleteTransactionsForCategory(
  categoryId: number
): Promise<number> {
  const { data, error } = await supabase.from('transactions').delete().eq('category_id', categoryId).select('id');
  if (error) throw error;
  return Array.isArray(data) ? (data as any[]).length : 0;
}

export async function getRecentTransactions(
  tgUserId: string,
  limit = 5
): Promise<TransactionRecord[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx')
    .eq('tg_user_id', tgUserId)
    .order('txn_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    tgUserId: row.tg_user_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    amountUsd: Number(row.amount_usd),
    sign: row.sign as 1 | -1,
    currency: row.currency as 'USD' | 'PLN' | 'UAH',
    note: row.note,
    txnAt: new Date(row.txn_at),
    rateDate: row.rate_date,
    isRateApprox: row.is_rate_approx
  }));
}
