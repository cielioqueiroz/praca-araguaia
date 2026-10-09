import { autorizadoPorCron } from '@/lib/cron';
import { backfillHistorico } from '@/lib/backfill';
import { FONTES_HISTORICO } from '@/lib/fontes/registry';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';
import { repositorioCotacoesNeon } from '@/lib/neon/repositorio-cotacoes';
import { buscarHistoricoPorUfConab, type TipoCommodity } from '@/lib/fontes/conab';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) {
    return new Response('unauthorized', { status: 401 });
  }
  if (new URL(req.url).searchParams.get('lugares') === '1') {
    if (process.env.DATABASE_PROVIDER !== 'neon') return new Response('historico local exige Neon', { status: 400 });
    const repoLugares = repositorioCotacoesNeon();
    const tipos: TipoCommodity[] = ['boi', 'soja', 'milho'];
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const resultados: Array<{ tipo: string; pontos: number }> = [];
    const erros: Array<{ tipo: string; erro: string }> = [];
    for (const tipo of tipos) {
      try {
        const series = await buscarHistoricoPorUfConab(tipo);
        const unidade = tipo === 'boi' ? 'R$/@' : 'R$/sc 60kg';
        const linhas = series.flatMap(({ uf, pontos }) =>
          pontos.filter((ponto) => ponto.data >= desde).map((ponto) => ({ uf, ponto, unidade })));
        await repoLugares.salvarHistoricoUfEmLote(tipo, 'conab', linhas);
        resultados.push({ tipo, pontos: linhas.length });
      } catch (erro) {
        console.error(`backfill de lugares ${tipo} falhou`, erro);
        erros.push({ tipo, erro: (erro as Error).message });
      }
    }
    return Response.json({ resultados, erros }, { status: erros.length > 0 ? 502 : 200 });
  }

  const repo = process.env.DATABASE_PROVIDER === 'neon'
    ? repositorioCotacoesNeon() : supabaseRepo(createServerClient());
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
