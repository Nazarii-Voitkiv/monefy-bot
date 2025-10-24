import { and, between, eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { categories, transactions } from '../db/schema.js';
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
  const filter = and(
    eq(transactions.tgUserId, tgUserId),
    between(transactions.txnAt, range.from, range.to)
  );

  const [row] = await db
    .select({
      totalUsd: sql<number>`coalesce(sum(${transactions.amountUsd}), 0)`,
      incomesUsd: sql<number>`coalesce(sum(case when ${transactions.sign} = 1 then ${transactions.amountUsd} else 0 end), 0)`,
      expensesUsd: sql<number>`coalesce(sum(case when ${transactions.sign} = -1 then ${transactions.amountUsd} else 0 end), 0)`
    })
    .from(transactions)
    .where(filter);

  if (!row) {
    return EMPTY_SUMMARY;
  }

  return {
    totalUsd: Number(row.totalUsd),
    incomesUsd: Number(row.incomesUsd),
    expensesUsd: Number(row.expensesUsd)
  };
}

export async function getTopExpenseCategories(
  tgUserId: string,
  range: StatsRange,
  limit = 5
): Promise<CategoryStat[]> {
  const filter = and(
    eq(transactions.tgUserId, tgUserId),
    between(transactions.txnAt, range.from, range.to)
  );

  const rows = await db
    .select({
      name: categories.name,
      total: sql<number>`coalesce(sum(${transactions.amountUsd}), 0)`
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(filter)
    .groupBy(categories.name)
    .orderBy(sql`sum(${transactions.amountUsd}) asc`)
    .limit(limit);

  return rows.map((row) => ({
    name: row.name,
    total: Number(row.total)
  }));
}
