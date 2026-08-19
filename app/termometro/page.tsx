import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { resumirReportes, ROTULO_ORIGEM, type OrigemReporte } from '@/lib/termometro';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';
import { PAGINAS_PRACA } from '@/lib/pracas-paginas';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Termômetro da Praça',
  description:
    'Quanto o produtor está realmente pegando na região do Araguaia: preços relatados por quem vendeu, conferidos antes de entrar na conta. Reporte o seu — é anônimo.',
};

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Araguaina' });

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
    <div className="wrap">
      <section className="pghero">
        <div className="kicker">Preço de quem tá na lida</div>
        <h1>
          O preço que
          <br />
          <em>ninguém publica</em>.
        </h1>
        <p className="lede">
          Nenhuma consultoria pesquisa a nossa cidade. O que está aqui veio de quem vendeu — e é o único lugar
          onde o preço do Araguaia existe.
        </p>
        <div className="pgmeta mono">
          {fmtHoje.format(new Date())} · valor típico dos últimos 7 dias · {ROTULO_ORIGEM.produtor} ou{' '}
          {ROTULO_ORIGEM.praca}
        </div>
        <Link href="/termometro/reportar" className="pgcta">
          Reportar o preço que você pegou
        </Link>
      </section>

      {resumos.length === 0 ? (
        <div className="pgvazio">
          <h2>Seja o primeiro a dizer quanto está valendo</h2>
          <p>
            Leva menos de um minuto, não pede cadastro e ninguém fica sabendo quem foi. Enquanto ninguém conta, o
            preço da nossa praça continua não existindo em lugar nenhum —{' '}
            <Link href="/termometro/reportar">comece por aqui</Link>.
          </p>
        </div>
      ) : (
        <section className="section">
          <div className="section-head">
            <div className="t">O que está sendo pago</div>
            <div className="line" />
            <div className="meta">
              Valor típico<span className="pill">7 dias</span>Mediana, não média
            </div>
          </div>
          <div className="pggrade">
            {resumos.map((r) => (
              <Link key={r.produto} href={`/termometro/${r.produto}`} aria-label={`Ver histórico de ${r.rotulo}`}>
                <CardTermometro resumo={r} mediaConab={conab.get(r.produto)} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="t">Por cidade</div>
          <div className="line" />
        </div>
        <nav className="cidoutras" aria-label="Praças">
          {PAGINAS_PRACA.map((p) => (
            <Link key={p.slug} href={`/praca/${p.slug}`}>
              {p.nome}
              <i>{p.uf}</i>
            </Link>
          ))}
        </nav>
      </section>

      <ConviteDistribuicao
        alvo="termometro"
        titulo={['O preço daqui só', 'existe se a gente contar.']}
        linha="Nenhuma consultoria pesquisa a nossa cidade. Manda para quem vendeu esta semana — o reporte é anônimo e leva um minuto."
      />
    </div>
  );
}
