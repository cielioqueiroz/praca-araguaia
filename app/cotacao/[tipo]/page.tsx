import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { supabaseRepo } from '@/lib/supabase/repo';
import { CardCotacao } from '@/components/CardCotacao';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { TITULOS, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

export default async function DetalheCotacao({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const supabase = createPublicClient();

  const { data: atual } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia')
    .eq('tipo', tipo)
    .maybeSingle();

  if (!atual) notFound();

  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const pontos = await supabaseRepo(supabase).historicoRecente(tipo, desde);
  const titulo = TITULOS[tipo] ?? tipo;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{titulo}</h1>

      <div className="mt-6 max-w-sm">
        <CardCotacao
          titulo={titulo}
          valor={Number(atual.valor)}
          unidade={atual.unidade}
          variacaoPct={atual.variacao_pct === null ? null : Number(atual.variacao_pct)}
          dataReferencia={atual.data_referencia}
          desatualizado={Date.now() - new Date(atual.data_referencia).getTime() > prazoDesatualizadoMs(tipo)}
          legenda={LEGENDAS[tipo]}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Tendência</h2>
        {pontos.length === 0 ? (
          <p className="text-neutral-500">Sem histórico ainda.</p>
        ) : (
          <GraficoCotacao pontos={pontos} titulo={titulo} unidade={atual.unidade} />
        )}
      </section>
    </main>
  );
}
