import {
  addDays,
  endOfDay,
  endOfMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays
} from 'date-fns';

export const DATE_TAG_REGEX = /^@(\d{4}-\d{2}-\d{2})$/;

export function parseDateTag(tag?: string): Date | null {
  if (!tag) {
    return null;
  }

  const match = DATE_TAG_REGEX.exec(tag.trim());
  if (!match) {
    return null;
  }

  return parseISO(match[1]);
}

export function ensureUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));
}

export function buildRangeForToday(now: Date): { from: Date; to: Date } {
  return {
    from: startOfDay(now),
    to: endOfDay(now)
  };
}

export function buildRangeForWeek(now: Date): { from: Date; to: Date } {
  const weekday = now.getUTCDay();
  const diff = (weekday + 6) % 7;
  const start = startOfDay(subDays(now, diff));
  return {
    from: start,
    to: endOfDay(now)
  };
}

export function buildRangeForMonth(now: Date): { from: Date; to: Date } {
  return {
    from: startOfMonth(now),
    to: endOfMonth(now)
  };
}

export function buildRangeForMonthString(month: string): { from: Date; to: Date } {
  const parsed = parseISO(`${month}-01`);
  return {
    from: startOfMonth(parsed),
    to: endOfMonth(parsed)
  };
}

export function buildRangeBetween(from: string, to: string): { from: Date; to: Date } {
  return {
    from: startOfDay(parseISO(from)),
    to: endOfDay(parseISO(to))
  };
}

export function formatDateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatRangeLabel(from: Date, to: Date): string {
  const fromLabel = formatDateLabel(from);
  const toLabel = formatDateLabel(to);
  return fromLabel === toLabel ? fromLabel : `${fromLabel} → ${toLabel}`;
}

export function nextDay(date: Date): Date {
  return addDays(date, 1);
}
