import { backfillHistorico } from '@/lib/backfill';
import { FONTES_HISTORICO } from '@/lib/fontes/registry';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const repo = supabaseRepo(createServerClient());
  const resultados: Array<{ tipo: string; pontos: number }> = [];
  const erros: Array<{ tipo: string; erro: string }> = [];

  for (const f of FONTES_HISTORICO) {
    try {
      resultados.push(await backfillHistorico(f.tipo, f.fonte, f.buscar, repo));
    } catch (e) {
      console.error(`backfill ${f.tipo} falhou`, e);
      erros.push({ tipo: f.tipo, erro: (e as Error).message });
    }
  }

  const status = resultados.length === 0 ? 502 : 200;
  return Response.json({ resultados, erros }, { status });
}
