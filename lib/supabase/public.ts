import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createPublicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
