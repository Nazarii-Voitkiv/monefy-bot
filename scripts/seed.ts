import { exit } from 'node:process';

import { env } from '../src/config/env.js';
import { supabase } from '../src/db/client.js';
import { ensureDefaultCategories } from '../src/services/categories.js';

type UserRow = { id: number; tg_user_id: string };

async function main(): Promise<void> {
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, tg_user_id');

  if (error) throw error;

  const usersList = allUsers ?? [];

  if (usersList.length === 0) {
    console.log('No users found. Seed will create a placeholder user.');
    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({ tg_user_id: 'demo-user', base_currency: env.DEFAULT_BASE_CURRENCY })
      .select('id, tg_user_id')
      .limit(1);

    if (insertError) throw insertError;

    if (created && created.length > 0) {
      usersList.push(created[0] as unknown as UserRow);
    } else {
      const { data: demo, error: readErr } = await supabase
        .from('users')
        .select('id, tg_user_id')
        .eq('tg_user_id', 'demo-user')
        .limit(1);
      if (readErr) throw readErr;
      if (demo && demo.length > 0) usersList.push(demo[0]);
    }
  }

  for (const user of usersList) {
    await ensureDefaultCategories(user.tg_user_id);
    console.log(`Seeded categories for ${user.tg_user_id}`);
  }
}

main()
  .then(() => {
    exit(0);
  })
  .catch((error) => {
    console.error(error);
    exit(1);
  });
