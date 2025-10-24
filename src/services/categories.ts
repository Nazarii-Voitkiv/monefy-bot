import { and, asc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { categories } from '../db/schema.js';
import type { CategoryKind } from '../types/index.js';

const DEFAULT_CATEGORIES: Array<{ name: string; kind: CategoryKind }> = [
  { name: 'food', kind: 'expense' },
  { name: 'transport', kind: 'expense' },
  { name: 'coffee', kind: 'expense' },
  { name: 'salary', kind: 'income' }
];

export interface CategoryRecord {
  id: number;
  name: string;
  tgUserId: string;
  kind: CategoryKind;
}

export async function ensureDefaultCategories(tgUserId: string): Promise<void> {
  const existing = await listCategories(tgUserId);
  if (existing.length > 0) {
    return;
  }

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((entry) => ({
      tgUserId,
      ...entry
    }))
  );
}

export async function addCategory(
  tgUserId: string,
  name: string,
  kind: CategoryKind
): Promise<CategoryRecord> {
  const normalized = name.trim().toLowerCase();
  const [created] = await db
    .insert(categories)
    .values({
      tgUserId,
      name: normalized,
      kind
    })
    .onConflictDoNothing()
    .returning({
      id: categories.id,
      tgUserId: categories.tgUserId,
      name: categories.name,
      kind: categories.kind
    });

  if (!created) {
    const existing = await getCategoryByName(tgUserId, normalized, kind);
    if (!existing) {
      throw new Error(`Cannot create category ${normalized}`);
    }

    return existing;
  }

  return created;
}

export async function listCategories(tgUserId: string): Promise<CategoryRecord[]> {
  return db
    .select({
      id: categories.id,
      tgUserId: categories.tgUserId,
      name: categories.name,
      kind: categories.kind
    })
    .from(categories)
    .where(eq(categories.tgUserId, tgUserId))
    .orderBy(asc(categories.kind), asc(categories.name));
}

export async function getCategoryByName(
  tgUserId: string,
  name: string,
  kind?: CategoryKind
): Promise<CategoryRecord | undefined> {
  const where = kind
    ? and(eq(categories.tgUserId, tgUserId), eq(categories.name, name), eq(categories.kind, kind))
    : and(eq(categories.tgUserId, tgUserId), eq(categories.name, name));

  const [found] = await db
    .select({
      id: categories.id,
      tgUserId: categories.tgUserId,
      name: categories.name,
      kind: categories.kind
    })
    .from(categories)
    .where(where);

  return found;
}

export async function removeCategory(tgUserId: string, name: string): Promise<number> {
  const result = await db
    .delete(categories)
    .where(and(eq(categories.tgUserId, tgUserId), eq(categories.name, name)));

  return result.rowCount ?? 0;
}

export async function requireCategory(
  tgUserId: string,
  name: string,
  kind: CategoryKind
): Promise<CategoryRecord> {
  const normalized = name.trim().toLowerCase();
  const category = await getCategoryByName(tgUserId, normalized, kind);
  if (!category) {
    throw new Error(
      `Категорія “${normalized}” не знайдена. Додай: /cat add ${normalized} ${kind}`
    );
  }

  return category;
}
