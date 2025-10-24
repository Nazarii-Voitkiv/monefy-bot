import {
  bigserial,
  bigint,
  boolean,
  date,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const currencyEnum = pgEnum('currency_enum', ['USD', 'PLN', 'UAH']);
export const categoryKindEnum = pgEnum('category_kind_enum', ['income', 'expense']);

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tgUserId: text('tg_user_id').notNull().unique(),
  baseCurrency: text('base_currency').notNull().default('USD'),
  locale: text('locale').notNull().default('uk-UA'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export const categories = pgTable(
  'categories',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tgUserId: text('tg_user_id').notNull(),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    byUserNameKind: uniqueIndex('categories_user_name_kind_idx').on(
      table.tgUserId,
      table.name,
      table.kind
    )
  })
);

export const transactions = pgTable('transactions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tgUserId: text('tg_user_id').notNull(),
  categoryId: bigint('category_id', { mode: 'number' })
    .references(() => categories.id)
    .notNull(),
  sign: smallint('sign').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull().$type<string>(),
  currency: currencyEnum('currency').notNull(),
  amountUsd: numeric('amount_usd', { precision: 14, scale: 2 })
    .notNull()
    .$type<string>(),
  note: text('note'),
  txnAt: timestamp('txn_at', { withTimezone: true }).notNull(),
  rateDate: date('rate_date').notNull(),
  isRateApprox: boolean('is_rate_approx').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export const fxRates = pgTable('fx_rates', {
  rateDate: date('rate_date').primaryKey().$type<string>(),
  base: text('base').notNull().default('USD'),
  pln: numeric('pln', { precision: 14, scale: 6 }).notNull().$type<string>(),
  uah: numeric('uah', { precision: 14, scale: 6 }).notNull().$type<string>(),
  usd: numeric('usd', { precision: 14, scale: 6 })
    .notNull()
    .default('1')
    .$type<string>(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  transactions: many(transactions)
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.tgUserId],
    references: [users.tgUserId]
  }),
  transactions: many(transactions)
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id]
  }),
  user: one(users, {
    fields: [transactions.tgUserId],
    references: [users.tgUserId]
  })
}));
