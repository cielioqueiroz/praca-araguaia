import { createPublicClient } from '@/lib/supabase/public';
import { montarTicker } from '@/lib/ticker';
import type { LinhaTicker } from '@/lib/ticker';

// O ticker do topo é client component (roda no layout inteiro): serve as cotações
// já gravadas, com cache de CDN — nunca números fixos no código.
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const supabase = createPublicClient();
  const [mercado, pracas, ufs] = await Promise.all([
    supabase.from('cotacoes').select('tipo, valor, variacao_pct, data_referencia').eq('tipo', 'dolar'),
    supabase.from('cotacoes_praca').select('tipo, praca, uf, valor, variacao_pct, data_referencia').eq('tipo', 'boi'),
    supabase.from('cotacoes_uf').select('tipo, uf, valor, variacao_pct, data_referencia').in('tipo', ['soja', 'milho']).eq('uf', 'PA'),
  ]);
  if (mercado.error || pracas.error || ufs.error) return Response.json({ itens: [] }, { status: 200 });

  // A faixa é lida sem contexto: só entra um preço cujo lugar cabe no rótulo.
  // Redenção é o centro da Praça; se faltar, outra praça do PA leva seu nome real.
  const boi = (pracas.data ?? []).find((p) => p.praca === 'Redenção' && p.uf === 'PA')
    ?? (pracas.data ?? []).find((p) => p.uf === 'PA');
  const linhas: LinhaTicker[] = [
    ...(boi ? [{ ...boi, tipo: 'boi', local: `${boi.praca}/PA` }] : []),
    ...(ufs.data ?? []).map((u) => ({ ...u, local: 'PA' })),
    ...(mercado.data ?? []),
  ].map((c) => ({
    tipo: String(c.tipo), local: 'local' in c ? String(c.local) : undefined,
    valor: Number(c.valor),
    variacao_pct: c.variacao_pct === null ? null : Number(c.variacao_pct),
    data_referencia: String(c.data_referencia),
  }));
  const itens = montarTicker(linhas);

  return Response.json(
    { itens },
    { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  );
}
