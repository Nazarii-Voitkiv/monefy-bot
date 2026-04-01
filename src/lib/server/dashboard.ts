import {
  listCategories,
  listCategoriesWithUsage
} from '../../services/categories';
import {
  listFilteredTransactions,
  type NormalizedTransactionsQuery,
  normalizeTransactionsQuery,
  type TransactionRecord
} from '../../services/transactions';
import type {
  CategoriesResponse,
  CategoryBreakdownItem,
  DailySeriesPoint,
  DashboardPeriod,
  DashboardResponse,
  FrontendCategory,
  FrontendTransaction,
  TransactionsQuery,
  TransactionsResponse
} from '../../types/index';
import {
  buildRangeForLast30Days,
  buildRangeForMonth,
  buildRangeForToday,
  buildRangeForWeek
} from '../../utils/date';

function resolvePresetPeriod(period: DashboardPeriod): { from: Date; to: Date } {
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

export function normalizeDashboardQuery(
  query: TransactionsQuery
): NormalizedTransactionsQuery {
  const normalized = normalizeTransactionsQuery(query);
  if (
    normalized.period &&
    !normalized.dateFrom &&
    !normalized.dateTo
  ) {
    const range = resolvePresetPeriod(normalized.period);
    return {
      ...normalized,
      dateFrom: range.from.toISOString().slice(0, 10),
      dateTo: range.to.toISOString().slice(0, 10)
    };
  }

  return normalized;
}

export function mapTransactions(
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

function getRangeLabel(filters: NormalizedTransactionsQuery): string {
  if (filters.dateFrom && filters.dateTo) {
    return filters.dateFrom === filters.dateTo
      ? filters.dateFrom
      : `${filters.dateFrom} → ${filters.dateTo}`;
  }

  if (filters.dateFrom) {
    return `Від ${filters.dateFrom}`;
  }

  if (filters.dateTo) {
    return `До ${filters.dateTo}`;
  }

  return 'Усі дати';
}

export function sortFrontendTransactions(
  items: FrontendTransaction[],
  filters: NormalizedTransactionsQuery
): FrontendTransaction[] {
  const direction = filters.sortOrder === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('uk-UA', { numeric: true, sensitivity: 'base' });

  return [...items].sort((left, right) => {
    let result = 0;

    switch (filters.sortBy) {
      case 'amount':
        result = left.amount - right.amount;
        break;
      case 'amountUsd':
        result = left.amountUsd - right.amountUsd;
        break;
      case 'category':
        result = collator.compare(left.categoryName, right.categoryName);
        break;
      case 'currency':
        result = collator.compare(left.currency, right.currency);
        break;
      case 'date':
      default:
        result = new Date(left.txnAt).getTime() - new Date(right.txnAt).getTime();
        break;
    }

    if (result === 0) {
      result = left.id - right.id;
    }

    return result * direction;
  });
}

function buildBreakdown(
  items: FrontendTransaction[],
  sign: 1 | -1
): CategoryBreakdownItem[] {
  const sums = new Map<string, number>();

  for (const item of items) {
    if (item.sign !== sign) {
      continue;
    }

    sums.set(item.categoryName, (sums.get(item.categoryName) ?? 0) + Math.abs(item.amountUsd));
  }

  return Array.from(sums.entries())
    .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }))
    .sort((left, right) => right.total - left.total);
}

function buildDailySeries(items: FrontendTransaction[]): DailySeriesPoint[] {
  const points = new Map<string, DailySeriesPoint>();

  for (const item of items) {
    const date = item.txnAt.slice(0, 10);
    const current = points.get(date) ?? {
      date,
      expensesUsd: 0,
      incomesUsd: 0
    };

    if (item.sign === 1) {
      current.incomesUsd += Math.abs(item.amountUsd);
    } else {
      current.expensesUsd += Math.abs(item.amountUsd);
    }

    points.set(date, current);
  }

  return Array.from(points.values())
    .map((point) => ({
      date: point.date,
      expensesUsd: Number(point.expensesUsd.toFixed(2)),
      incomesUsd: Number(point.incomesUsd.toFixed(2))
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function paginateItems<T>(
  items: T[],
  page: number,
  limit: number
): { items: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    totalPages
  };
}

export async function buildDashboardData(
  tgUserId: string,
  query: TransactionsQuery
): Promise<DashboardResponse> {
  const filters = normalizeDashboardQuery(query);
  const [transactions, categories] = await Promise.all([
    listFilteredTransactions(tgUserId, filters),
    listCategories(tgUserId)
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const sorted = sortFrontendTransactions(mapTransactions(transactions, categoryNames), filters);

  let totalUsd = 0;
  let incomesUsd = 0;
  let expensesUsd = 0;

  for (const item of sorted) {
    totalUsd += item.amountUsd;
    if (item.sign === 1) {
      incomesUsd += Math.abs(item.amountUsd);
    } else {
      expensesUsd += Math.abs(item.amountUsd);
    }
  }

  return {
    breakdown: {
      expenses: buildBreakdown(sorted, -1),
      incomes: buildBreakdown(sorted, 1)
    },
    dailySeries: buildDailySeries(sorted),
    generatedAt: new Date().toISOString(),
    period: filters.period ?? null,
    rangeLabel: getRangeLabel(filters),
    recentTransactions: sorted.slice(0, 8),
    summary: {
      expensesUsd: Number(expensesUsd.toFixed(2)),
      incomesUsd: Number(incomesUsd.toFixed(2)),
      totalUsd: Number(totalUsd.toFixed(2))
    },
    totalTransactions: sorted.length
  };
}

export async function buildTransactionsData(
  tgUserId: string,
  query: TransactionsQuery
): Promise<TransactionsResponse> {
  const filters = normalizeDashboardQuery(query);
  const [transactions, categories] = await Promise.all([
    listFilteredTransactions(tgUserId, filters),
    listCategories(tgUserId)
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const sorted = sortFrontendTransactions(mapTransactions(transactions, categoryNames), filters);
  const paginated = paginateItems(sorted, filters.page, filters.limit);

  return {
    items: paginated.items,
    limit: filters.limit,
    page: Math.min(filters.page, paginated.totalPages),
    total: paginated.total,
    totalPages: paginated.totalPages
  };
}

export async function buildCategoriesData(
  tgUserId: string
): Promise<CategoriesResponse> {
  const items: FrontendCategory[] = (await listCategoriesWithUsage(tgUserId)).map((category) => ({
    id: category.id,
    kind: category.kind,
    name: category.name,
    usageCount: category.usageCount
  }));

  return { items };
}
