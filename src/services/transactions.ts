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

export interface UpdateTransactionArgs {
  categoryId?: number;
  amount?: number;
  sign?: 1 | -1;
  currency?: 'USD' | 'PLN' | 'UAH';
  note?: string | null;
  txnDate?: Date;
  rateDate?: string;
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

export async function getTransactions(
  tgUserId: string,
  page = 1,
  limit = 20
): Promise<{ data: TransactionRecord[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from('transactions')
    .select(
      'id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx',
      { count: 'exact' }
    )
    .eq('tg_user_id', tgUserId)
    .order('txn_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const records = (data || []).map((row: any) => ({
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

  return { data: records, total: count || 0 };
}

export async function deleteTransaction(id: number, tgUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('tg_user_id', tgUserId);

  if (error) throw error;
  return true;
}

export async function updateTransaction(
  id: number,
  tgUserId: string,
  updates: UpdateTransactionArgs,
  fxProvider: FxProvider
): Promise<TransactionRecord> {
  // 1. Fetch existing transaction to get current values
  const { data: existingData, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('tg_user_id', tgUserId)
    .single();

  if (fetchError || !existingData) {
    throw new Error(`Transaction not found or access denied: ${fetchError?.message}`);
  }

  // 2. Prepare new values
  const currentCategory = existingData.category_id;
  const currentAmount = Number(existingData.amount);
  const currentCurrency = existingData.currency as 'USD' | 'PLN' | 'UAH';
  const currentSign = existingData.sign as 1 | -1;
  const currentTxnAt = new Date(existingData.txn_at);
  const currentRateDate = existingData.rate_date;

  const newCategory = updates.categoryId ?? currentCategory;
  const newAmount = updates.amount ?? currentAmount;
  const newCurrency = updates.currency ?? currentCurrency;
  const newSign = updates.sign ?? currentSign;
  const newTxnAt = updates.txnDate ?? currentTxnAt;
  const newRateDate = updates.rateDate ?? currentRateDate;

  // 3. Check if we need to re-calculate USD amount
  // We need to recalc if amount, currency, sign, or rateDate changed.
  // We also might want to recalc if the original rate was approx and we want to refresh it,
  // but let's stick to explicit updates for now.
  let newAmountUsd = Number(existingData.amount_usd);
  let newIsRateApprox = existingData.is_rate_approx;
  let newRealRateDate = newRateDate;

  const needsRecalc =
    updates.amount !== undefined ||
    updates.currency !== undefined ||
    updates.sign !== undefined ||
    updates.rateDate !== undefined;

  if (needsRecalc) {
    const fxRate = await fxProvider.getDailyRates(newRateDate);
    newAmountUsd = convertAmountToUsd(fxRate, newAmount, newCurrency, newSign);
    newIsRateApprox = fxRate.isApprox;
    newRealRateDate = fxRate.rateDate;
  }

  // 4. Update in DB
  const { data: updatedData, error: updateError } = await supabase
    .from('transactions')
    .update({
      category_id: newCategory,
      amount: toPgNumeric(newAmount),
      currency: newCurrency,
      amount_usd: toPgNumeric(newAmountUsd),
      sign: newSign,
      note: updates.note !== undefined ? updates.note : existingData.note,
      txn_at: newTxnAt.toISOString(),
      rate_date: newRealRateDate,
      is_rate_approx: newIsRateApprox
    })
    .eq('id', id)
    .eq('tg_user_id', tgUserId)
    .select(
      'id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx'
    )
    .single();

  if (updateError) throw updateError;
  if (!updatedData) throw new Error('Failed to update transaction');

  return {
    id: updatedData.id,
    tgUserId: updatedData.tg_user_id,
    categoryId: updatedData.category_id,
    amount: Number(updatedData.amount),
    amountUsd: Number(updatedData.amount_usd),
    sign: updatedData.sign as 1 | -1,
    currency: updatedData.currency as 'USD' | 'PLN' | 'UAH',
    note: updatedData.note,
    txnAt: new Date(updatedData.txn_at),
    rateDate: updatedData.rate_date,
    isRateApprox: updatedData.is_rate_approx
  };
}
