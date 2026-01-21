import NodeCache from 'node-cache';

import { env } from '../config/env.js';
import { supabase } from '../db/client.js';

const userCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache for user profile

export interface UserRecord {
  id: number;
  tgUserId: string;
  baseCurrency: string;
  locale: string;
}

export async function findUser(tgUserId: string): Promise<UserRecord | undefined> {
  const cached = userCache.get<UserRecord>(`user:${tgUserId}`);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, tg_user_id, base_currency, locale')
    .eq('tg_user_id', tgUserId)
    .limit(1);

  if (error) throw error;
  const row = data && data[0];
  if (!row) return undefined;

  const user = {
    id: row.id,
    tgUserId: row.tg_user_id,
    baseCurrency: row.base_currency,
    locale: row.locale
  };
  userCache.set(`user:${tgUserId}`, user);
  return user;
}

export async function ensureUser(tgUserId: string): Promise<{ user: UserRecord; isNew: boolean }> {
  const existing = await findUser(tgUserId);
  if (existing) {
    return { user: existing, isNew: false };
  }
  const { data, error } = await supabase
    .from('users')
    .insert({ tg_user_id: tgUserId, base_currency: env.DEFAULT_BASE_CURRENCY, locale: 'uk-UA' })
    .select('id, tg_user_id, base_currency, locale')
    .limit(1);

  if (error) throw error;
  const created = data && data[0];
  const user = {
    id: created.id,
    tgUserId: created.tg_user_id,
    baseCurrency: created.base_currency,
    locale: created.locale
  };
  userCache.set(`user:${tgUserId}`, user);
  return { user, isNew: true };
}

export async function updateUserBaseCurrency(
  tgUserId: string,
  baseCurrency: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ base_currency: baseCurrency })
    .eq('tg_user_id', tgUserId);

  if (error) throw error;
  userCache.del(`user:${tgUserId}`);
}
