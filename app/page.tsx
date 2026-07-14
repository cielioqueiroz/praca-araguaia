import { createPublicClient } from '@/lib/supabase/public';
import { TITULOS, ORDEM_PAINEL, PORTEIRA, UNIDADE_PORTEIRA } from '@/lib/tipos-ui';
import { rodapeDaFonte } from '@/lib/boletim';
import { MUNICIPIOS } from '@/lib/fontes/chuva';
import { mediana } from '@/lib/termometro';
import { CardPorteira, type PrecoCidadeUI, type PrecoUfUI } from '@/components/redesign/CardPorteira';
import { TabelaMercado, type ItemMercado } from '@/components/redesign/TabelaMercado';
import { SuaPraca } from '@/components/redesign/SuaPraca';
import { Revelar } from '@/components/redesign/Revelar';

export const dynamic = 'force-dynamic';

type Cotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string };
type LinhaUf = { tipo: string; uf: string; valor: number; variacao_pct: number | null; data_referencia: string };

const MERCADO: Record<string, { unLabel: string; casas: number }> = {
  dolar: { unLabel: 'comercial', casas: 4 },
  euro: { unLabel: 'comercial', casas: 4 },
  ouro: { unLabel: 'por grama · 999', casas: 2 },
  ouro18k: { unLabel: 'por grama · 750', casas: 2 },
  bitcoin: { unLabel: 'por unidade', casas: 2 },
  ethereum: { unLabel: 'por unidade', casas: 2 },
};

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Araguaina' });

export default async function Home() {
  const supabase = createPublicClient();

  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: atuais }, { data: porUf }, { data: hist }, { data: reportes }] = await Promise.all([
    supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct, data_referencia'),
    supabase.from('cotacoes_uf').select('tipo, uf, valor, variacao_pct, data_referencia'),
    supabase
      .from('cotacoes_historico')
      .select('tipo, valor, data_referencia')
      .gte('data_referencia', trintaDias)
      .order('data_referencia', { ascending: true }),
    supabase
      .from('reportes')
      .select('produto, municipio, valor')
      .eq('status', 'aprovado')
      .eq('produto', 'boi')
      .gte('criado_em', seteDias),
  ]);

  const historicoPorTipo = new Map<string, number[]>();
  for (const h of hist ?? []) {
    const arr = historicoPorTipo.get(h.tipo as string) ?? [];
    arr.push(Number(h.valor));
    historicoPorTipo.set(h.tipo as string, arr);
  }

  const ufsPorTipo = new Map<string, PrecoUfUI[]>();
  const refPorTipo = new Map<string, string>();
  for (const l of ((porUf ?? []) as LinhaUf[])) {
    const arr = ufsPorTipo.get(l.tipo) ?? [];
    arr.push({ uf: l.uf, valor: Number(l.valor), variacaoPct: l.variacao_pct === null ? null : Number(l.variacao_pct) });
    ufsPorTipo.set(l.tipo, arr);
    const atual = refPorTipo.get(l.tipo);
    if (!atual || l.data_referencia > atual) refPorTipo.set(l.tipo, l.data_referencia);
  }

  // Boi nas cidades da praça: valor típico (mediana) dos reportes aprovados de 7 dias.
  // Cidade sem reporte continua na lista, como convite — não some.
  const valoresPorCidade = new Map<string, number[]>();
  for (const r of (reportes ?? []) as { municipio: string; valor: number }[]) {
    const arr = valoresPorCidade.get(r.municipio) ?? [];
    arr.push(Number(r.valor));
    valoresPorCidade.set(r.municipio, arr);
  }
  const cidades: PrecoCidadeUI[] = MUNICIPIOS.map((m) => {
    const valores = valoresPorCidade.get(m.nome) ?? [];
    return {
      municipio: m.nome,
      uf: m.uf,
      mediana: valores.length ? mediana(valores) : null,
      contagem: valores.length,
    };
  }).sort((a, b) => (b.contagem > 0 ? 1 : 0) - (a.contagem > 0 ? 1 : 0));

  const cotacoes = ((atuais ?? []) as Cotacao[]).slice().sort((a, b) => posicao(a.tipo) - posicao(b.tipo));

  const mercado: ItemMercado[] = cotacoes
    .filter((c) => c.tipo in MERCADO)
    .map((c) => ({
      tipo: c.tipo,
      titulo: TITULOS[c.tipo] ?? c.tipo,
      valor: Number(c.valor),
      casas: MERCADO[c.tipo].casas,
      unLabel: MERCADO[c.tipo].unLabel,
      variacaoPct: c.variacao_pct === null ? null : Number(c.variacao_pct),
      historico: historicoPorTipo.get(c.tipo) ?? [],
    }));

  const temPorteira = PORTEIRA.some((t) => (ufsPorTipo.get(t) ?? []).length > 0);
  const agora = new Date();

  return (
    <div className="wrap">
      <section className="hero">
        <div className="text">
          <div className="kicker">Cotações de referência</div>
          <h1>
            A praça
            <br />
            <em>hoje</em>.
          </h1>
          <p className="lede">Preços de referência da porteira ao mercado, nas praças do Vale do Araguaia.</p>
          <div className="meta">
            <div className="big">{fmtHoje.format(agora)}</div>
            <div className="mono">
              Atualizado {fmtHora.format(agora)}, fontes CONAB, Datagro, Scot, BCB, CoinGecko
            </div>
          </div>
          <SuaPraca />
        </div>
        <div className="photo">
          {/* Foto de terceiro: o crédito ao Asocebu Bolivia fica na imagem, não é decorativo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/hero-cebu.jpg" alt="Rhaya FIV Moxos, touro cebu nascido na Bolívia" />
          <div className="overlay" />
          <span className="tag">Cebu · Rhaya FIV Moxos</span>
          <span className="credit">Foto: Asocebu Bolivia</span>
        </div>
      </section>

      {temPorteira && (
        <section className="section">
          <div className="section-head">
            <div className="t">Na porteira</div>
            <div className="line" />
            <div className="meta">
              Preço de cada estado<span className="pill">CONAB · Datagro · Scot</span>Gado e grão
            </div>
          </div>
          <div className="pcards">
            {PORTEIRA.map((tipo, i) => {
              const precos = ufsPorTipo.get(tipo) ?? [];
              const ref = refPorTipo.get(tipo);
              if (precos.length === 0 || !ref) return null;
              return (
                // O Revelar vira o filho do grid: a largura do boi tem de estar nele.
                <Revelar key={tipo} delay={i * 0.08} className={tipo === 'boi' ? 'largo' : undefined}>
                  <CardPorteira
                    tipo={tipo}
                    titulo={TITULOS[tipo] ?? tipo}
                    unLabel={UNIDADE_PORTEIRA[tipo]}
                    rodape={rodapeDaFonte(tipo, ref)}
                    precos={precos}
                    cidades={tipo === 'boi' ? cidades : undefined}
                    largo={tipo === 'boi'}
                  />
                </Revelar>
              );
            })}
          </div>
        </section>
      )}

      {mercado.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t">Mercado</div>
            <div className="line" />
            <div className="meta">
              Câmbio, ouro e cripto<span className="pill">BCB · CoinGecko</span>Diário
            </div>
          </div>
          <TabelaMercado itens={mercado} />
        </section>
      )}

      {cotacoes.length === 0 && !temPorteira && (
        <p className="mono" style={{ marginTop: 48 }}>Ainda sem cotação — rode a coleta.</p>
      )}
    </div>
  );
}
