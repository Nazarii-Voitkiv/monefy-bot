import { supabase } from '../db/client';
import type {
  CurrencyCode,
  TransactionSortBy,
  TransactionsQuery,
  TransactionTypeFilter
} from '../types/index';
import type { CategoryRecord } from './categories';
import type { FxProvider,FxRate } from './fxProvider';

export interface CreateTransactionArgs {
  tgUserId: string;
  category: CategoryRecord;
  sign: 1 | -1;
  amount: number;
  currency: CurrencyCode;
  note: string | null;
  txnDate: Date;
  rateDate: string;
  fxProvider: FxProvider;
}

export interface UpdateTransactionArgs {
  categoryId?: number;
  amount?: number;
  sign?: 1 | -1;
  currency?: CurrencyCode;
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
  currency: CurrencyCode;
  note: string | null;
  txnAt: Date;
  rateDate: string;
  isRateApprox: boolean;
}

export interface NormalizedTransactionsQuery {
  amountMax?: number;
  amountMin?: number;
  categoryId?: number;
  currency?: CurrencyCode;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  page: number;
  period?: TransactionsQuery['period'];
  search?: string;
  sortBy: TransactionSortBy;
  sortOrder: 'asc' | 'desc';
  type: TransactionTypeFilter;
}

function mapRowToTransactionRecord(row: any): TransactionRecord {
  return {
    id: row.id,
    tgUserId: row.tg_user_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    amountUsd: Number(row.amount_usd),
    sign: row.sign as 1 | -1,
    currency: row.currency as CurrencyCode,
    note: row.note,
    txnAt: new Date(row.txn_at),
    rateDate: row.rate_date,
    isRateApprox: row.is_rate_approx
  };
}

export function normalizeTransactionsQuery(
  query: TransactionsQuery
): NormalizedTransactionsQuery {
  const safePage =
    typeof query.page === 'number' && Number.isFinite(query.page) && query.page > 0
      ? Math.floor(query.page)
      : 1;
  const safeLimit =
    typeof query.limit === 'number' && Number.isFinite(query.limit)
      ? Math.min(Math.max(Math.floor(query.limit), 1), 100)
      : 20;
  const type = query.type === 'income' || query.type === 'expense' ? query.type : 'all';
  const sortBy: TransactionSortBy =
    query.sortBy === 'amount' ||
    query.sortBy === 'amountUsd' ||
    query.sortBy === 'category' ||
    query.sortBy === 'currency'
      ? query.sortBy
      : 'date';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    amountMax:
      typeof query.amountMax === 'number' && Number.isFinite(query.amountMax)
        ? query.amountMax
        : undefined,
    amountMin:
      typeof query.amountMin === 'number' && Number.isFinite(query.amountMin)
        ? query.amountMin
        : undefined,
    categoryId:
      typeof query.categoryId === 'number' && Number.isFinite(query.categoryId)
        ? query.categoryId
        : undefined,
    currency: query.currency,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: safeLimit,
    page: safePage,
    period: query.period,
    search: query.search?.trim() || undefined,
    sortBy,
    sortOrder,
    type
  };
}

function convertAmountToUsd(rate: FxRate, amount: number, currency: CurrencyCode, sign: 1 | -1): number {
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
  return mapRowToTransactionRecord(created);
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

  return (data || []).map(mapRowToTransactionRecord);
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

  const records = (data || []).map(mapRowToTransactionRecord);

  return { data: records, total: count || 0 };
}

export async function getTransactionById(
  id: number,
  tgUserId: string
): Promise<TransactionRecord | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx'
    )
    .eq('id', id)
    .eq('tg_user_id', tgUserId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRowToTransactionRecord(data) : null;
}

export async function listFilteredTransactions(
  tgUserId: string,
  query: TransactionsQuery
): Promise<TransactionRecord[]> {
  const normalized = normalizeTransactionsQuery(query);
  let request = supabase
    .from('transactions')
    .select(
      'id, tg_user_id, category_id, amount, amount_usd, sign, currency, note, txn_at, rate_date, is_rate_approx'
    )
    .eq('tg_user_id', tgUserId);

  if (normalized.type === 'income') {
    request = request.eq('sign', 1);
  } else if (normalized.type === 'expense') {
    request = request.eq('sign', -1);
  }

  if (normalized.categoryId) {
    request = request.eq('category_id', normalized.categoryId);
  }

  if (normalized.currency) {
    request = request.eq('currency', normalized.currency);
  }

  if (normalized.search) {
    request = request.ilike('note', `%${normalized.search}%`);
  }

  if (normalized.dateFrom) {
    request = request.gte('txn_at', `${normalized.dateFrom}T00:00:00.000Z`);
  }

  if (normalized.dateTo) {
    request = request.lte('txn_at', `${normalized.dateTo}T23:59:59.999Z`);
  }

  if (typeof normalized.amountMin === 'number') {
    request = request.gte('amount', normalized.amountMin);
  }

  if (typeof normalized.amountMax === 'number') {
    request = request.lte('amount', normalized.amountMax);
  }

  const { data, error } = await request.order('txn_at', { ascending: false });
  if (error) throw error;

  return (data || []).map(mapRowToTransactionRecord);
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
    const currentCurrency = existingData.currency as CurrencyCode;
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
    currency: updatedData.currency as CurrencyCode,
    note: updatedData.note,
    txnAt: new Date(updatedData.txn_at),
    rateDate: updatedData.rate_date,
    isRateApprox: updatedData.is_rate_approx
  };
}
