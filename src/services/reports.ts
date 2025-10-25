import { supabase } from '../db/client.js';
import type { StatsRange } from '../types/index.js';

export interface SummaryStats {
  totalUsd: number;
  incomesUsd: number;
  expensesUsd: number;
}

export interface CategoryStat {
  name: string;
  total: number;
}

const EMPTY_SUMMARY: SummaryStats = {
  totalUsd: 0,
  incomesUsd: 0,
  expensesUsd: 0
};

export async function getSummaryStats(
  tgUserId: string,
  range: StatsRange
): Promise<SummaryStats> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount_usd, sign')
    .eq('tg_user_id', tgUserId)
    .gte('txn_at', range.from.toISOString())
    .lte('txn_at', range.to.toISOString());

  if (error) throw error;
  if (!data || data.length === 0) return EMPTY_SUMMARY;

  let total = 0;
  let incomes = 0;
  let expenses = 0;
  for (const r of data as any[]) {
    const val = Number(r.amount_usd) || 0;
    total += val;
    if (r.sign === 1) incomes += val;
    else if (r.sign === -1) expenses += val;
  }

  return { totalUsd: total, incomesUsd: incomes, expensesUsd: expenses };
}

export async function getTopExpenseCategories(
  tgUserId: string,
  range: StatsRange,
  limit = 5
): Promise<CategoryStat[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount_usd')
    .eq('tg_user_id', tgUserId)
    .gte('txn_at', range.from.toISOString())
    .lte('txn_at', range.to.toISOString());

  if (error) throw error;

  const sums: Record<number, number> = {};
  for (const r of (data || []) as any[]) {
    const val = Number(r.amount_usd) || 0;
    const id = Number(r.category_id);
    sums[id] = (sums[id] || 0) + val;
  }

  const entries = Object.entries(sums).map(([k, v]) => ({ id: Number(k), total: v }));
  entries.sort((a, b) => b.total - a.total);
  const top = entries.slice(0, limit);

  if (top.length === 0) return [];

  const ids = top.map((t) => t.id);
  const { data: cats, error: catsErr } = await supabase.from('categories').select('id, name').in('id', ids);
  if (catsErr) throw catsErr;

  const namesById: Record<number, string> = {};
  for (const c of (cats || []) as any[]) namesById[c.id] = c.name;

  return top.map((t) => ({ name: namesById[t.id] || 'unknown', total: t.total }));
}

export interface CategoryBreakdown {
  incomes: CategoryStat[];
  expenses: CategoryStat[];
}

export async function getCategoryBreakdown(
  tgUserId: string,
  range: StatsRange
): Promise<CategoryBreakdown> {
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount_usd, sign')
    .eq('tg_user_id', tgUserId)
    .gte('txn_at', range.from.toISOString())
    .lte('txn_at', range.to.toISOString());

  if (error) throw error;

  const sumsBySign: Record<number, number> = {};
  const sumsBySignExpenses: Record<number, number> = {};
  const sumsBySignIncomes: Record<number, number> = {};

  for (const r of (data || []) as any[]) {
    const raw = Number(r.amount_usd) || 0;
    const val = Math.abs(raw);
    const id = Number(r.category_id) || 0;
    if (r.sign === 1) {
      sumsBySignIncomes[id] = (sumsBySignIncomes[id] || 0) + val;
    } else if (r.sign === -1) {
      sumsBySignExpenses[id] = (sumsBySignExpenses[id] || 0) + val;
    }
  }

  const incomeEntries = Object.entries(sumsBySignIncomes).map(([k, v]) => ({ id: Number(k), total: v }));
  const expenseEntries = Object.entries(sumsBySignExpenses).map(([k, v]) => ({ id: Number(k), total: v }));

  incomeEntries.sort((a, b) => b.total - a.total);
  expenseEntries.sort((a, b) => b.total - a.total);

  const ids = Array.from(new Set([...incomeEntries.map((e) => e.id), ...expenseEntries.map((e) => e.id)])).filter(Boolean);

  let namesById: Record<number, string> = {};
  if (ids.length > 0) {
    const { data: cats, error: catsErr } = await supabase.from('categories').select('id, name').in('id', ids);
    if (catsErr) throw catsErr;
    for (const c of (cats || []) as any[]) namesById[c.id] = c.name;
  }

  const incomes = incomeEntries.map((e) => ({ name: namesById[e.id] || 'unknown', total: e.total }));
  const expenses = expenseEntries.map((e) => ({ name: namesById[e.id] || 'unknown', total: e.total }));

  return { incomes, expenses };
}
