import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardCotacao } from '@/components/CardCotacao';
import { TITULOS, ORDEM_PAINEL, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

export default async function Home() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');

  const cotacoes = (data ?? []).slice().sort((a, b) => posicao(a.tipo) - posicao(b.tipo));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-900">agro_app</h1>
      <p className="mt-1 text-sm text-neutral-500">Cotações de referência diárias para o produtor.</p>
      <Link href="/boletim" className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
        Boletim do dia →
      </Link>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {error && <p className="text-red-600">Erro ao carregar cotações.</p>}
        {!error && cotacoes.length === 0 && (
          <p className="text-neutral-500">Ainda sem cotação — rode a coleta (/api/coletar).</p>
        )}
        {cotacoes.map((c) => (
          <Link key={c.tipo} href={`/cotacao/${c.tipo}`} className="block transition hover:opacity-90">
            <CardCotacao
              titulo={TITULOS[c.tipo] ?? c.tipo}
              valor={Number(c.valor)}
              unidade={c.unidade}
              variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
              dataReferencia={c.data_referencia}
              desatualizado={Date.now() - new Date(c.data_referencia).getTime() > prazoDesatualizadoMs(c.tipo)}
              legenda={LEGENDAS[c.tipo]}
            />
          </Link>
        ))}
      </section>
    </main>
  );
}
