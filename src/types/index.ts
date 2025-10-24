export type CurrencyCode = 'USD' | 'PLN' | 'UAH';

export type CategoryKind = 'income' | 'expense';

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
