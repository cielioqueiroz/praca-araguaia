import { createPublicClient } from '@/lib/supabase/public';
import { montarTicker } from '@/lib/ticker';

// O ticker do topo é client component (roda no layout inteiro): serve as cotações
// já gravadas, com cache de CDN — nunca números fixos no código.
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('cotacoes').select('tipo, valor, variacao_pct');
  if (error) return Response.json({ itens: [] }, { status: 200 });

  const itens = montarTicker(
    (data ?? []).map((c) => ({
      tipo: c.tipo as string,
      valor: Number(c.valor),
      variacao_pct: c.variacao_pct === null ? null : Number(c.variacao_pct),
    })),
  );

  return Response.json(
    { itens },
    { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  );
}
