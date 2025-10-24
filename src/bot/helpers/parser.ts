import type { CurrencyCode } from '../../types/index.js';
import { parseDateTag } from '../../utils/date.js';

const INPUT_REGEX =
  /^([+-]?)\s*(\d+(?:[.,]\d{1,2})?)\s*(PLN|UAH|USD)?\s*(@\d{4}-\d{2}-\d{2})?\s*(.*)$/i;

export interface ParsedTransactionInput {
  sign: 1 | -1;
  amount: number;
  currency: CurrencyCode;
  categoryName: string;
  note: string | null;
  rateDate: string;
  txnDate: Date;
}

export class ParseError extends Error {}

export function parseTransactionInput(
  message: string,
  defaultCurrency: CurrencyCode
): ParsedTransactionInput {
  const trimmed = message.trim();
  const match = INPUT_REGEX.exec(trimmed);
  if (!match) {
    throw new ParseError('Не можу розпізнати транзакцію. Спробуй формат "- 45 PLN coffee".');
  }

  const [, signSymbol, rawAmount, rawCurrency, dateTag, rest] = match;
  const sign: 1 | -1 = signSymbol === '+' ? 1 : -1;

  const amount = Number(rawAmount.replace(',', '.'));
  if (Number.isNaN(amount)) {
    throw new ParseError('Сума виглядає некоректною.');
  }

  const currency = (rawCurrency?.toUpperCase() as CurrencyCode) ?? defaultCurrency;

  const restTrimmed = rest?.trim() ?? '';
  if (!restTrimmed) {
    throw new ParseError(
      'Категорія обовʼязкова. Приклад: "- 45.9 PLN coffee @2025-10-22".'
    );
  }

  const parts = restTrimmed.split(/\s+/);
  const categoryNameRaw = parts.shift();

  if (!categoryNameRaw) {
    throw new ParseError('Категорія обовʼязкова.');
  }

  let txnDate = parseDateTag(dateTag) ?? new Date();
  let rateDate = txnDate.toISOString().slice(0, 10);

  const dateIndex = parts.findIndex((token) => Boolean(parseDateTag(token)));
  if (dateIndex >= 0) {
    const parsedDate = parseDateTag(parts[dateIndex]);
    if (parsedDate) {
      txnDate = parsedDate;
      rateDate = parsedDate.toISOString().slice(0, 10);
    }
    parts.splice(dateIndex, 1);
  }

  const categoryName = categoryNameRaw.toLowerCase();
  const note = parts.length > 0 ? parts.join(' ') : null;

  return {
    sign,
    amount,
    currency,
    categoryName,
    note,
    txnDate,
    rateDate
  };
}
