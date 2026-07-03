import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardCotacao } from '@/components/CardCotacao';
import { TITULOS, ORDEM_PAINEL, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

// Duas naturezas de dado: regional-semanal (porteira) e global-diário (mercado).
const TIPOS_PORTEIRA = new Set(['boi', 'soja', 'milho']);
const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });

type Cotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string };

function CardLink({ c }: { c: Cotacao }) {
  return (
    <Link
      href={`/cotacao/${c.tipo}`}
      className="group block rounded-xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
    >
      <CardCotacao
        titulo={TITULOS[c.tipo] ?? c.tipo}
        valor={Number(c.valor)}
        unidade={c.unidade}
        variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
        dataReferencia={c.data_referencia}
        desatualizado={Date.now() - new Date(c.data_referencia).getTime() > prazoDesatualizadoMs(c.tipo)}
      />
    </Link>
  );
}

export default async function Home() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');

  const cotacoes = ((data ?? []) as Cotacao[]).slice().sort((a, b) => posicao(a.tipo) - posicao(b.tipo));
  const porteira = cotacoes.filter((c) => TIPOS_PORTEIRA.has(c.tipo));
  const mercado = cotacoes.filter((c) => !TIPOS_PORTEIRA.has(c.tipo));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Cotações de referência</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">A praça hoje</h1>
      <p className="mt-1 text-sm text-tinta/50">{fmtHoje.format(new Date())}</p>

      {error && <p className="mt-8 text-red-600">Erro ao carregar cotações.</p>}
      {!error && cotacoes.length === 0 && (
        <p className="mt-8 text-tinta/50">Ainda sem cotação — rode a coleta (/api/coletar).</p>
      )}

      {porteira.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-linha pb-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Na porteira</h2>
            <p className="text-xs text-tinta/45">média MT/PA/TO/GO · CONAB · semanal</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {porteira.map((c) => (
              <CardLink key={c.tipo} c={c} />
            ))}
          </div>
        </section>
      )}

      {mercado.length > 0 && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-linha pb-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Mercado</h2>
            <p className="text-xs text-tinta/45">câmbio e reservas · diário</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {mercado.map((c) => (
              <CardLink key={c.tipo} c={c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
