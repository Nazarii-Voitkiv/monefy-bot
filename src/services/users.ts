import { eq } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

export interface UserRecord {
  id: number;
  tgUserId: string;
  baseCurrency: string;
  locale: string;
}

export async function findUser(tgUserId: string): Promise<UserRecord | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      tgUserId: users.tgUserId,
      baseCurrency: users.baseCurrency,
      locale: users.locale
    })
    .from(users)
    .where(eq(users.tgUserId, tgUserId));

  return row;
}

export async function ensureUser(tgUserId: string): Promise<UserRecord> {
  const existing = await findUser(tgUserId);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      tgUserId,
      baseCurrency: env.DEFAULT_BASE_CURRENCY,
      locale: 'uk-UA'
    })
    .returning({
      id: users.id,
      tgUserId: users.tgUserId,
      baseCurrency: users.baseCurrency,
      locale: users.locale
    });

  return created;
}

export async function updateUserBaseCurrency(
  tgUserId: string,
  baseCurrency: string
): Promise<void> {
  await db
    .update(users)
    .set({ baseCurrency })
    .where(eq(users.tgUserId, tgUserId));
}
