import { buscarHistoricoDolarBcb } from '@/lib/fontes/dolar';
import { backfillHistorico } from '@/lib/backfill';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }
  try {
    const repo = supabaseRepo(createServerClient());
    const resultado = await backfillHistorico(() => buscarHistoricoDolarBcb(90), repo);
    return Response.json(resultado);
  } catch (e) {
    console.error('falha no backfill', e);
    return new Response('erro no backfill', { status: 502 });
  }
}
