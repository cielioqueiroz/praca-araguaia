import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clienteNeonEscrita } from '@/lib/neon/cliente';

export function createServerClient(): SupabaseClient {
  if (process.env.DATABASE_PROVIDER === 'neon') return clienteNeonEscrita();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
