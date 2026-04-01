export type CurrencyCode = 'USD' | 'PLN' | 'UAH';

export type CategoryKind = 'income' | 'expense';
export type DashboardPeriod = 'today' | 'week' | 'month' | 'last30';
export type TransactionTypeFilter = 'all' | 'income' | 'expense';
export type TransactionSortBy = 'date' | 'amount' | 'amountUsd' | 'category' | 'currency';
export type SortOrder = 'asc' | 'desc';

export interface TransactionInput {
  tgUserId: string;
  sign: 1 | -1;
  amount: number;
  currency: CurrencyCode;
  categoryName: string;
  note: string | null;
  txnDate: Date;
  rateDate: string;
}

export interface StatsRange {
  from: Date;
  to: Date;
}

export interface FrontendTransaction {
  id: number;
  amount: number;
  amountUsd: number;
  categoryId: number;
  categoryName: string;
  currency: CurrencyCode;
  note: string | null;
  rateDate: string;
  sign: 1 | -1;
  txnAt: string;
  isRateApprox: boolean;
}

export interface FrontendCategory {
  id: number;
  kind: CategoryKind;
  name: string;
  usageCount: number;
}

export interface DashboardSummary {
  totalUsd: number;
  incomesUsd: number;
  expensesUsd: number;
}

export interface CategoryBreakdownItem {
  name: string;
  total: number;
}

export interface DashboardResponse {
  generatedAt: string;
  period: DashboardPeriod | null;
  rangeLabel: string;
  summary: DashboardSummary;
  totalTransactions: number;
  breakdown: {
    incomes: CategoryBreakdownItem[];
    expenses: CategoryBreakdownItem[];
  };
  recentTransactions: FrontendTransaction[];
}

export interface TransactionsQuery {
  amountMax?: number;
  amountMin?: number;
  categoryId?: number;
  currency?: CurrencyCode;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page?: number;
  period?: DashboardPeriod;
  search?: string;
  sortBy?: TransactionSortBy;
  sortOrder?: SortOrder;
  type?: TransactionTypeFilter;
}

export interface TransactionsResponse {
  items: FrontendTransaction[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface CategoriesResponse {
  items: FrontendCategory[];
}
