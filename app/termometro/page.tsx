import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { resumirReportes, ROTULO_ORIGEM, type OrigemReporte } from '@/lib/termometro';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Termômetro da Praça' };

export default async function Termometro() {
  const supabase = createPublicClient();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // A RLS só entrega aprovados para o client anon.
  const { data: reportes } = await supabase
    .from('reportes')
    .select('produto, municipio, valor, origem')
    .gte('criado_em', desde);

  const { data: cotacoes } = await supabase.from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const resumos = resumirReportes(
    (reportes ?? []).map((r) => ({
      produto: r.produto,
      municipio: r.municipio,
      valor: Number(r.valor),
      origem: (r.origem ?? 'produtor') as OrigemReporte,
    })),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Preço de quem tá na lida</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Termômetro da Praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Valor típico do que está sendo pago na região nos últimos 7 dias — conferido antes de entrar na conta e
        resistente a um lance fora da curva. Cada card diz de onde veio o preço: {ROTULO_ORIGEM.produtor} ou{' '}
        {ROTULO_ORIGEM.praca}.
      </p>

      <Link
        href="/termometro/reportar"
        className="mt-5 inline-block rounded-lg bg-pasto px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Reportar preço
      </Link>

      {resumos.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
          <p className="font-display text-lg font-bold text-mata">Seja o primeiro a reportar o preço da sua praça</p>
          <p className="mt-1 text-sm text-tinta/50">Leva menos de um minuto e não pede cadastro.</p>
        </div>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {resumos.map((r) => (
            <Link
              key={r.produto}
              href={`/termometro/${r.produto}`}
              aria-label={`Ver histórico de ${r.rotulo}`}
              className="rounded-xl transition hover:shadow-[0_2px_10px_rgba(28,38,32,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              <CardTermometro resumo={r} mediaConab={conab.get(r.produto)} />
            </Link>
          ))}
        </section>
      )}

      <ConviteDistribuicao
        alvo="termometro"
        titulo={['O preço daqui só', 'existe se a gente contar.']}
        linha="Nenhuma consultoria pesquisa a nossa cidade. Manda para quem vendeu esta semana — o reporte é anônimo e leva um minuto."
      />
    </main>
  );
}
