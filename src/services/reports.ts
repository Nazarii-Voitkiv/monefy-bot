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
  // Fetch transactions in range and aggregate in JS since we use Supabase REST
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
  // Fetch expense transactions in range and group by category_id in JS
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

  // Fetch category names for top ids
  const ids = top.map((t) => t.id);
  const { data: cats, error: catsErr } = await supabase.from('categories').select('id, name').in('id', ids);
  if (catsErr) throw catsErr;

  const namesById: Record<number, string> = {};
  for (const c of (cats || []) as any[]) namesById[c.id] = c.name;

  return top.map((t) => ({ name: namesById[t.id] || 'unknown', total: t.total }));
}
