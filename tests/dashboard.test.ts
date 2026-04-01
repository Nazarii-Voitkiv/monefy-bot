import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeDashboardQuery,
  sortFrontendTransactions
} from '../src/lib/server/dashboard';
import type { FrontendTransaction } from '../src/types/index';

const SAMPLE_TRANSACTIONS: FrontendTransaction[] = [
  {
    amount: 50,
    amountUsd: -12.5,
    categoryId: 2,
    categoryName: 'coffee',
    currency: 'PLN',
    id: 2,
    isRateApprox: false,
    note: 'morning latte',
    rateDate: '2026-04-01',
    sign: -1,
    txnAt: '2026-04-01T07:00:00.000Z'
  },
  {
    amount: 1200,
    amountUsd: 1200,
    categoryId: 4,
    categoryName: 'salary',
    currency: 'USD',
    id: 1,
    isRateApprox: false,
    note: 'salary',
    rateDate: '2026-04-01',
    sign: 1,
    txnAt: '2026-04-02T07:00:00.000Z'
  },
  {
    amount: 20,
    amountUsd: -20,
    categoryId: 1,
    categoryName: 'books',
    currency: 'USD',
    id: 3,
    isRateApprox: false,
    note: 'book',
    rateDate: '2026-04-01',
    sign: -1,
    txnAt: '2026-03-30T07:00:00.000Z'
  }
];

test('normalizeDashboardQuery expands period into date range', () => {
  const normalized = normalizeDashboardQuery({ period: 'month' });

  assert.equal(normalized.period, 'month');
  assert.match(normalized.dateFrom ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.match(normalized.dateTo ?? '', /^\d{4}-\d{2}-\d{2}$/);
});

test('sortFrontendTransactions sorts by category ascending', () => {
  const sorted = sortFrontendTransactions(SAMPLE_TRANSACTIONS, {
    limit: 20,
    page: 1,
    sortBy: 'category',
    sortOrder: 'asc',
    type: 'all'
  });

  assert.deepEqual(
    sorted.map((item) => item.categoryName),
    ['books', 'coffee', 'salary']
  );
});

test('sortFrontendTransactions sorts by amount descending', () => {
  const sorted = sortFrontendTransactions(SAMPLE_TRANSACTIONS, {
    limit: 20,
    page: 1,
    sortBy: 'amount',
    sortOrder: 'desc',
    type: 'all'
  });

  assert.deepEqual(
    sorted.map((item) => item.amount),
    [1200, 50, 20]
  );
});
