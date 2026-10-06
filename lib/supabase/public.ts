import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clienteNeonLeitura } from '@/lib/neon/cliente';

export function createPublicClient(): SupabaseClient {
  if (process.env.DATABASE_PROVIDER === 'neon') return clienteNeonLeitura();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
