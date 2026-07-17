import { autorizadoPorCron } from '@/lib/cron';
import { coletarCotacao } from '@/lib/coleta';
import { FONTES } from '@/lib/fontes/registry';
import { buscarPorUf, type TipoCommodity } from '@/lib/fontes/conab';
import { buscarPorUfPecuaria, type TipoPecuaria } from '@/lib/fontes/pecuaria';
import { buscarPorPracaScot, type TipoScot } from '@/lib/fontes/scot';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { PrecoPraca, PrecoUf } from '@/types/cotacao';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) {
    return new Response('unauthorized', { status: 401 });
  }

  const repo = supabaseRepo(createServerClient());
  const coletadas: Array<{ tipo: string; valor: number }> = [];
  const porUf: Array<{ tipo: string; ufs: number }> = [];
  const porPraca: Array<{ tipo: string; pracas: number }> = [];
  const erros: Array<{ tipo: string; erro: string }> = [];

  for (const [tipo, fonte] of Object.entries(FONTES)) {
    try {
      const r = await coletarCotacao(fonte, repo);
      coletadas.push({ tipo, valor: r.valor });
    } catch (e) {
      console.error(`coleta ${tipo} falhou`, e);
      erros.push({ tipo, erro: (e as Error).message });
    }
  }

  // Preço por UF (PA/MT/TO/GO). Grãos e boi vêm do arquivo da CONAB já baixado acima;
  // novilha/bezerro vêm dos indicadores de reposição da Scot (a CONAB não publica
  // essas categorias). Falha de um tipo não invalida os que já entraram.
  const commodities: TipoCommodity[] = ['boi', 'soja', 'milho'];
  const pecuaria: TipoPecuaria[] = ['novilha', 'bezerro'];

  const porUfDe: Array<{ tipo: string; buscar: () => Promise<PrecoUf[]> }> = [
    ...commodities.map((tipo) => ({ tipo, buscar: () => buscarPorUf(tipo) })),
    ...pecuaria.map((tipo) => ({ tipo, buscar: () => buscarPorUfPecuaria(tipo) })),
  ];

  for (const { tipo, buscar } of porUfDe) {
    try {
      const precos = await buscar();
      await repo.salvarPrecosUf(precos);
      porUf.push({ tipo, ufs: precos.length });
    } catch (e) {
      console.error(`coleta por UF de ${tipo} falhou`, e);
      erros.push({ tipo: `${tipo}_uf`, erro: (e as Error).message });
    }
  }

  // Preço por PRAÇA: boi e vaca da Scot (Marabá, Redenção, Paragominas, Cuiabá…).
  // É o recorte que a região realmente negocia; a UF fica como pano de fundo.
  const porPracaDe: Array<{ tipo: string; buscar: () => Promise<PrecoPraca[]> }> =
    (['boi', 'vaca'] as TipoScot[]).map((tipo) => ({ tipo, buscar: () => buscarPorPracaScot(tipo) }));

  for (const { tipo, buscar } of porPracaDe) {
    try {
      const precos = await buscar();
      await repo.salvarPrecosPraca(precos);
      porPraca.push({ tipo, pracas: precos.length });
    } catch (e) {
      console.error(`coleta por praça de ${tipo} falhou`, e);
      erros.push({ tipo: `${tipo}_praca`, erro: (e as Error).message });
    }
  }

  const status = coletadas.length === 0 ? 502 : 200;
  return Response.json({ coletadas, porUf, porPraca, erros }, { status });
}
