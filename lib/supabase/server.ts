import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
