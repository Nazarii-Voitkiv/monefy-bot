import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be provided in environment');
}

export const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// Only Supabase JS is exported now. Direct Postgres/drizzle usage removed.
