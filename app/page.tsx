import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardCotacao } from '@/components/CardCotacao';

export const dynamic = 'force-dynamic';

const TITULOS: Record<string, string> = { dolar: 'Dólar', euro: 'Euro', ouro: 'Ouro' };
const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;

export default async function Home() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-900">agro_app</h1>
      <p className="mt-1 text-sm text-neutral-500">Cotações de referência diárias para o produtor.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {error && <p className="text-red-600">Erro ao carregar cotações.</p>}
        {!error && (!data || data.length === 0) && (
          <p className="text-neutral-500">Ainda sem cotação — rode a coleta (/api/coletar).</p>
        )}
        {data?.map((c) => (
          <Link key={c.tipo} href={`/cotacao/${c.tipo}`} className="block transition hover:opacity-90">
            <CardCotacao
              titulo={TITULOS[c.tipo] ?? c.tipo}
              valor={Number(c.valor)}
              unidade={c.unidade}
              variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
              dataReferencia={c.data_referencia}
              desatualizado={Date.now() - new Date(c.data_referencia).getTime() > DOIS_DIAS_MS}
            />
          </Link>
        ))}
      </section>
    </main>
  );
}
