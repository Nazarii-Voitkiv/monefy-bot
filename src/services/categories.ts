import NodeCache from 'node-cache';
import { supabase } from '../db/client.js';
import type { CategoryKind } from '../types/index.js';

const categoryCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

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

function getCacheKey(tgUserId: string): string {
  return `categories:${tgUserId}`;
}

export async function ensureDefaultCategories(tgUserId: string): Promise<void> {
  // Try to check cache first to avoid DB call if we know categories exist
  const cached = categoryCache.get<CategoryRecord[]>(getCacheKey(tgUserId));
  if (cached && cached.length > 0) {
    return;
  }

  const existing = await listCategories(tgUserId);
  if (existing.length > 0) {
    return;
  }
  const payload = DEFAULT_CATEGORIES.map((entry) => ({ tg_user_id: tgUserId, name: entry.name, kind: entry.kind }));
  const { error } = await supabase.from('categories').insert(payload);
  if (error) throw error;

  categoryCache.del(getCacheKey(tgUserId));
}

export async function addCategory(
  tgUserId: string,
  name: string,
  kind: CategoryKind
): Promise<CategoryRecord> {
  const normalized = name.trim().toLowerCase();
  const { data, error } = await supabase
    .from('categories')
    .insert({ tg_user_id: tgUserId, name: normalized, kind })
    .select('id, tg_user_id, name, kind')
    .limit(1);

  if (error) {
    const existing = await getCategoryByName(tgUserId, normalized, kind);
    if (!existing) throw error;
    // Cache might be stale so we invalidate it just in case
    categoryCache.del(getCacheKey(tgUserId));
    return existing;
  }

  categoryCache.del(getCacheKey(tgUserId));

  const created = data && data[0];
  return {
    id: created.id,
    name: created.name,
    tgUserId: created.tg_user_id,
    kind: created.kind
  };
}

export async function listCategories(tgUserId: string): Promise<CategoryRecord[]> {
  const key = getCacheKey(tgUserId);
  const cached = categoryCache.get<CategoryRecord[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('categories')
    .select('id, tg_user_id, name, kind')
    .eq('tg_user_id', tgUserId)
    .order('kind', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  const result = (data || []).map((r: any) => ({ id: r.id, name: r.name, tgUserId: r.tg_user_id, kind: r.kind }));
  categoryCache.set(key, result);
  return result;
}

export async function getCategoryByName(
  tgUserId: string,
  name: string,
  kind?: CategoryKind
): Promise<CategoryRecord | undefined> {
  let query = supabase.from('categories').select('id, tg_user_id, name, kind').eq('tg_user_id', tgUserId).eq('name', name).limit(1);
  if (kind) query = query.eq('kind', kind as string);

  const { data, error } = await query;
  if (error) throw error;
  const r = data && data[0];
  if (!r) return undefined;
  return { id: r.id, name: r.name, tgUserId: r.tg_user_id, kind: r.kind };
}

export async function removeCategory(tgUserId: string, name: string): Promise<number> {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .match({ tg_user_id: tgUserId, name })
    .select('id');

  if (error) throw error;

  if (Array.isArray(data) && data.length > 0) {
    categoryCache.del(getCacheKey(tgUserId));
  }

  return Array.isArray(data) ? (data as any[]).length : 0;
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
