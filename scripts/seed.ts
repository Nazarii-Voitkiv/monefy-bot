import { exit } from 'node:process';

import { eq } from 'drizzle-orm';

import { env } from '../src/config/env.js';
import { closeDb, db } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { ensureDefaultCategories } from '../src/services/categories.js';

async function main(): Promise<void> {
  const allUsers = await db
    .select({
      id: users.id,
      tgUserId: users.tgUserId
    })
    .from(users);

  if (allUsers.length === 0) {
    console.log('No users found. Seed will create a placeholder user.');
    const [created] = await db
      .insert(users)
      .values({
        tgUserId: 'demo-user',
        baseCurrency: env.DEFAULT_BASE_CURRENCY
      })
      .onConflictDoNothing()
      .returning({
        id: users.id,
        tgUserId: users.tgUserId
      });

    if (created) {
      allUsers.push(created);
    } else {
      const [demo] = await db
        .select({
          id: users.id,
          tgUserId: users.tgUserId
        })
        .from(users)
        .where(eq(users.tgUserId, 'demo-user'));
      if (demo) {
        allUsers.push(demo);
      }
    }
  }

  for (const user of allUsers) {
    await ensureDefaultCategories(user.tgUserId);
    console.log(`Seeded categories for ${user.tgUserId}`);
  }
}

main()
  .then(async () => {
    await closeDb();
    exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    exit(1);
  });
