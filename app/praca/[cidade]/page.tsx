import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { buscarPrevisao } from '@/lib/fontes/chuva';
import { PAGINAS_PRACA, paginaPorSlug, cidadeComUf } from '@/lib/pracas-paginas';
import { NOME_UF } from '@/lib/praca';
import { TITULOS, UNIDADE_PORTEIRA, PORTEIRA, creditoFonte, prazoDesatualizadoMs } from '@/lib/tipos-ui';
import { resumirReportes, type OrigemReporte } from '@/lib/termometro';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';
import { convitePraca } from '@/lib/compartilhar';

// Estática com revalidação: é página feita para ser ACHADA (Google, link no grupo), e
// buscador não espera render dinâmico. 15 min é o mesmo ritmo da home.
export const revalidate = 900;

export function generateStaticParams() {
  return PAGINAS_PRACA.map((p) => ({ cidade: p.slug }));
}

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Araguaina' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Araguaina' });
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Araguaina' });

function brl(n: number, casas = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);
}

export async function generateMetadata({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade } = await params;
  const p = paginaPorSlug(cidade);
  if (!p) return { title: 'Praça' };

  // O título é a pergunta que a pessoa digita, não o nome da seção do site.
  const onde = cidadeComUf(p);
  return {
    title: `Preço do boi hoje em ${onde}`,
    description: p.temScot
      ? `Boi gordo e vaca gorda na praça de ${onde}, grãos no ${NOME_UF[p.uf] ?? p.uf}, o preço que produtores relataram e a chuva dos próximos 7 dias. Atualizado todo dia útil.`
      : `Preço do gado e dos grãos para ${onde}, o que produtores da cidade relataram e a chuva dos próximos 7 dias. Atualizado todo dia útil.`,
    alternates: { canonical: `/praca/${p.slug}` },
  };
}

export default async function Praca({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade } = await params;
  const pagina = paginaPorSlug(cidade);
  if (!pagina) notFound();

  const supabase = createPublicClient();
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: pracas }, { data: ufs }, { data: reportes }, previsoes] = await Promise.all([
    supabase
      .from('cotacoes_praca')
      .select('tipo, praca, valor, valor_prazo, unidade, variacao_pct, data_referencia')
      .eq('uf', pagina.uf),
    supabase.from('cotacoes_uf').select('tipo, valor, unidade, variacao_pct, data_referencia').eq('uf', pagina.uf),
    supabase
      .from('reportes')
      .select('produto, municipio, valor, origem')
      .eq('status', 'aprovado')
      .eq('municipio', pagina.nome)
      .gte('criado_em', seteDias),
    // Só busca a previsão de quem tem: cidade sem cobertura não paga a chamada.
    pagina.temChuva ? buscarPrevisao().catch(() => []) : Promise.resolve([]),
  ]);

  const linhasPraca = (pracas ?? []).map((r) => ({
    tipo: r.tipo as string,
    praca: r.praca as string,
    valor: Number(r.valor),
    valorPrazo: r.valor_prazo === null ? null : Number(r.valor_prazo),
    unidade: r.unidade as string,
    dataReferencia: r.data_referencia as string,
  }));

  /**
   * O gado desta página: a praça DA CIDADE quando a Scot pesquisa aqui; senão, a praça
   * de referência do estado — que é o mesmo número que o painel mostra.
   *
   * A primeira versão caía em `cotacoes_uf` para as cidades sem praça própria, e isso
   * trocava o dado bom pelo pior: em Confresa o card saía com o boi da CONAB (323,55
   * de 14/08, já marcado "desatualizado") enquanto a Scot tinha 329,00 de 17/08 na
   * mesma tela do site. Uma cidade não pode ver um preço mais velho que o painel.
   */
  const daPraca = linhasPraca.filter((r) => (pagina.temScot ? r.praca === pagina.nome : true));
  const gadoDeReferencia = !pagina.temScot;

  // O que a praça não pesquisa aqui vem do estado — dito com todas as letras, para
  // ninguém achar que o preço do bezerro foi apurado nesta cidade.
  const tiposDaPraca = new Set(daPraca.map((p) => p.tipo));
  const doEstado = (ufs ?? [])
    .map((r) => ({
      tipo: r.tipo as string,
      valor: Number(r.valor),
      unidade: r.unidade as string,
      variacaoPct: r.variacao_pct === null ? null : Number(r.variacao_pct),
      dataReferencia: r.data_referencia as string,
    }))
    .filter((r) => PORTEIRA.includes(r.tipo) && !tiposDaPraca.has(r.tipo))
    .sort((a, b) => PORTEIRA.indexOf(a.tipo) - PORTEIRA.indexOf(b.tipo));

  const resumos = resumirReportes(
    (reportes ?? []).map((r) => ({
      produto: r.produto as string,
      municipio: r.municipio as string,
      valor: Number(r.valor),
      origem: (r.origem ?? 'produtor') as OrigemReporte,
    })),
  );

  const chuva = previsoes.find((p) => p.municipio === pagina.nome);
  const chuvaSemana = chuva ? chuva.dias.reduce((t, d) => t + d.chuvaMm, 0) : null;
  const outras = PAGINAS_PRACA.filter((p) => p.slug !== pagina.slug);
  const desatualizado = (tipo: string, ref: string) =>
    Date.now() - new Date(ref).getTime() > prazoDesatualizadoMs(tipo);

  return (
    <div className="wrap">
      <section className="pghero">
        <div className="kicker">A praça de</div>
        <h1>
          {pagina.nome}
          <em> {pagina.uf}</em>
        </h1>
        <p className="lede">
          {pagina.temScot
            ? `O preço que o gado faz aqui — praça pesquisada, não média de estado — mais o grão do ${NOME_UF[pagina.uf] ?? pagina.uf} e a chuva da semana.`
            : `O preço que vale para quem negocia em ${pagina.nome}, o que os vizinhos relataram e a chuva da semana.`}
        </p>
        <div className="pgmeta mono">
          {fmtHoje.format(new Date())} · gado: {creditoFonte('boi')} · grão: {creditoFonte('soja')}
        </div>
      </section>

      {daPraca.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t">{gadoDeReferencia ? `O gado no ${NOME_UF[pagina.uf] ?? pagina.uf}` : 'O gado aqui'}</div>
            <div className="line" />
            <div className="meta">
              {gadoDeReferencia ? 'Praça de referência do estado' : 'Praça pesquisada aqui'}
              <span className="pill">Scot</span>
            </div>
          </div>
          <div className="cidgado">
            {daPraca.map((p) => (
              <div key={p.tipo} className="cidcard">
                <div className="ct">{TITULOS[p.tipo] ?? p.tipo}</div>
                <div className="cv tnum">{brl(p.valor)}</div>
                <div className="cu">{UNIDADE_PORTEIRA[p.tipo] ?? p.unidade}</div>
                {p.valorPrazo !== null && (
                  <div className="cp">
                    a prazo (30 dias) <b className="tnum">{brl(p.valorPrazo)}</b>
                  </div>
                )}
                <div className="cf mono">
                  {gadoDeReferencia && `${p.praca} · `}
                  fechamento {fmtDia.format(new Date(p.dataReferencia))}
                  {desatualizado(p.tipo, p.dataReferencia) && ' · desatualizado'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {doEstado.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t">{pagina.temScot ? 'O resto da porteira' : 'Na porteira'}</div>
            <div className="line" />
            <div className="meta">
              Preço do {NOME_UF[pagina.uf] ?? pagina.uf}
              <span className="pill">por estado</span>
            </div>
          </div>
          <ul className="cidlista">
            {doEstado.map((r) => (
              <li key={r.tipo}>
                <span className="l">
                  {TITULOS[r.tipo] ?? r.tipo}
                  <i>{UNIDADE_PORTEIRA[r.tipo] ?? r.unidade}</i>
                </span>
                <span className="v tnum">{brl(r.valor)}</span>
                <span className="d mono">
                  {fmtDia.format(new Date(r.dataReferencia))}
                  {desatualizado(r.tipo, r.dataReferencia) && ' · desatualizado'}
                </span>
              </li>
            ))}
          </ul>
          <p className="cidnota">
            Estes a fonte publica por estado, não por cidade — valem como referência para quem negocia em{' '}
            {pagina.nome}, não como preço apurado aqui.{' '}
            {gadoDeReferencia &&
              `O gado acima também é de fora da cidade: a Scot pesquisa a praça de referência do ${NOME_UF[pagina.uf] ?? pagina.uf}.`}
          </p>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="t">O preço de quem tá na lida</div>
          <div className="line" />
          <div className="meta">
            Termômetro da Praça<span className="pill">7 dias</span>
          </div>
        </div>
        {resumos.length > 0 ? (
          <ul className="cidlista">
            {resumos.map((r) => (
              <li key={r.produto}>
                <span className="l">
                  {r.rotulo}
                  <i>{r.unidade}</i>
                </span>
                <span className="v tnum">{brl(r.mediana)}</span>
                <span className="d mono">{r.procedencia}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cidvazio">
            Ninguém relatou preço em {pagina.nome} nos últimos 7 dias. Se você vendeu por aqui,{' '}
            <Link href="/termometro/reportar">conte por quanto</Link> — é anônimo, leva um minuto, e é o único
            jeito de existir preço desta cidade em algum lugar.
          </p>
        )}
      </section>

      {chuva && (
        <section className="section">
          <div className="section-head">
            <div className="t">A chuva da semana</div>
            <div className="line" />
            <div className="meta">
              7 dias<span className="pill">{brl(chuvaSemana ?? 0, 1)} mm</span>
            </div>
          </div>
          <ul className="cidchuva">
            {chuva.dias.map((d) => (
              <li key={d.data} className={d.chuvaMm >= 1 ? 'molhado' : ''}>
                <span className="dia mono">{fmtDiaSemana.format(new Date(`${d.data}T12:00:00`))}</span>
                <span className="mm tnum">{d.chuvaMm >= 0.1 ? `${brl(d.chuvaMm, 1)} mm` : '—'}</span>
                <span className="t mono">
                  {Math.round(d.tempMin)}° / {Math.round(d.tempMax)}°
                </span>
              </li>
            ))}
          </ul>
          <p className="cidnota">
            Previsão da Open-Meteo para {pagina.nome}. A semana inteira das cinco cidades está em{' '}
            <Link href="/chuva">chuva na região</Link>.
          </p>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="t">Outras praças</div>
          <div className="line" />
        </div>
        <nav className="cidoutras" aria-label="Outras praças">
          {outras.map((o) => (
            <Link key={o.slug} href={`/praca/${o.slug}`}>
              {o.nome}
              <i>{o.uf}</i>
            </Link>
          ))}
        </nav>
      </section>

      <ConviteDistribuicao
        alvo="cotacoes"
        personalizado={convitePraca(pagina.nome, pagina.slug)}
        titulo={[`O preço de ${pagina.nome}`, 'no grupo certo.']}
        linha={`Manda para quem compra e vende em ${pagina.nome}. É de graça e não pede cadastro de ninguém.`}
      />
    </div>
  );
}
