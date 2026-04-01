import {
  listCategories
} from '../../services/categories';
import {
  getCategoryBreakdown,
  getSummaryStats
} from '../../services/reports';
import {
  getRecentTransactions,
  getTransactions,
  type TransactionRecord
} from '../../services/transactions';
import type {
  DashboardPeriod,
  DashboardResponse,
  FrontendTransaction,
  TransactionsResponse
} from '../../types/index';
import {
  buildRangeForLast30Days,
  buildRangeForMonth,
  buildRangeForToday,
  buildRangeForWeek,
  formatRangeLabel
} from '../../utils/date';

function normalizePeriod(period: string | null): DashboardPeriod {
  if (period === 'today' || period === 'week' || period === 'month' || period === 'last30') {
    return period;
  }

  return 'month';
}

function resolvePeriodRange(period: DashboardPeriod): { from: Date; to: Date } {
  const now = new Date();

  switch (period) {
    case 'today':
      return buildRangeForToday(now);
    case 'week':
      return buildRangeForWeek(now);
    case 'last30':
      return buildRangeForLast30Days(now);
    case 'month':
    default:
      return buildRangeForMonth(now);
  }
}

function mapTransactions(
  transactions: TransactionRecord[],
  categoryNames: Map<number, string>
): FrontendTransaction[] {
  return transactions.map((transaction) => ({
    id: transaction.id,
    amount: transaction.amount,
    amountUsd: transaction.amountUsd,
    categoryId: transaction.categoryId,
    categoryName: categoryNames.get(transaction.categoryId) ?? 'Невідома категорія',
    currency: transaction.currency,
    note: transaction.note,
    rateDate: transaction.rateDate,
    sign: transaction.sign,
    txnAt: transaction.txnAt.toISOString(),
    isRateApprox: transaction.isRateApprox
  }));
}

export async function buildDashboardData(
  tgUserId: string,
  requestedPeriod: string | null
): Promise<DashboardResponse> {
  const period = normalizePeriod(requestedPeriod);
  const range = resolvePeriodRange(period);

  const [summary, breakdown, recentTransactions, categories] = await Promise.all([
    getSummaryStats(tgUserId, range),
    getCategoryBreakdown(tgUserId, range),
    getRecentTransactions(tgUserId, 8),
    listCategories(tgUserId)
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return {
    generatedAt: new Date().toISOString(),
    period,
    rangeLabel: formatRangeLabel(range.from, range.to),
    summary,
    breakdown,
    recentTransactions: mapTransactions(recentTransactions, categoryNames)
  };
}

export async function buildTransactionsData(
  tgUserId: string,
  page: number,
  limit: number
): Promise<TransactionsResponse> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 50) : 20;

  const [{ data, total }, categories] = await Promise.all([
    getTransactions(tgUserId, safePage, safeLimit),
    listCategories(tgUserId)
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return {
    items: mapTransactions(data, categoryNames),
    limit: safeLimit,
    page: safePage,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit))
  };
}
