import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { supabaseRepo } from '@/lib/supabase/repo';
import { CardCotacao } from '@/components/CardCotacao';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { TITULOS, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

// Sem isto a aba de /cotacao/boi dizia só "cotações do agro" — o título padrão do
// layout. Quem abre o gráfico do boi e o do dólar lado a lado não distinguia as abas.
// A marca vem do template do layout.
export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const titulo = TITULOS[tipo];
  return { title: titulo ? `${titulo} — cotação` : 'Cotação' };
}

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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/cotacoes" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-mata">{titulo}</h1>

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

      <section className="mt-10">
        <div className="border-b border-linha pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Tendência</h2>
        </div>
        <div className="mt-4">
          {pontos.length === 0 ? (
            <p className="text-tinta/50">Sem histórico ainda.</p>
          ) : (
            <GraficoCotacao pontos={pontos} titulo={titulo} unidade={atual.unidade} />
          )}
        </div>
      </section>
    </main>
  );
}
