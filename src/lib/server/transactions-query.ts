import type {
  CurrencyCode,
  DashboardPeriod,
  TransactionSortBy,
  TransactionsQuery,
  TransactionTypeFilter
} from '../../types/index';

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseTransactionsQuery(
  searchParams: URLSearchParams
): TransactionsQuery {
  const type = searchParams.get('type');
  const period = searchParams.get('period');
  const currency = searchParams.get('currency');
  const sortBy = searchParams.get('sortBy');

  return {
    amountMax: parseNumber(searchParams.get('amountMax')),
    amountMin: parseNumber(searchParams.get('amountMin')),
    categoryId: parseNumber(searchParams.get('categoryId')),
    currency:
      currency === 'USD' || currency === 'PLN' || currency === 'UAH'
        ? (currency as CurrencyCode)
        : undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    limit: parseNumber(searchParams.get('limit')),
    page: parseNumber(searchParams.get('page')),
    period:
      period === 'today' || period === 'week' || period === 'month' || period === 'last30'
        ? (period as DashboardPeriod)
        : undefined,
    search: searchParams.get('search') || undefined,
    sortBy:
      sortBy === 'amount' ||
      sortBy === 'amountUsd' ||
      sortBy === 'category' ||
      sortBy === 'currency' ||
      sortBy === 'date'
        ? (sortBy as TransactionSortBy)
        : undefined,
    sortOrder: searchParams.get('sortOrder') === 'asc' ? 'asc' : undefined,
    type:
      type === 'income' || type === 'expense' || type === 'all'
        ? (type as TransactionTypeFilter)
        : undefined
  };
}
