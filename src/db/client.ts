import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../config/env.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000
});

export const db = drizzle(pool);

export async function closeDb(): Promise<void> {
  await pool.end();
}

export { pool as dbPool };
