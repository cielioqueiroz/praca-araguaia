import { createPublicClient } from '@/lib/supabase/public';
import { TITULOS, ORDEM_PAINEL, PORTEIRA, UNIDADE_PORTEIRA, NAO_E_MOEDA } from '@/lib/tipos-ui';
import { rodapeDaFonte } from '@/lib/boletim';
import { cidadesDoProduto, type ReporteAprovado } from '@/lib/termometro';
import { ordenarPorUf } from '@/lib/praca';
import { CardPorteira, type PrecoCidadeUI, type PrecoPracaUI, type PrecoUfUI } from '@/components/redesign/CardPorteira';
import { TabelaMercado, type ItemMercado } from '@/components/redesign/TabelaMercado';
import { SuaPraca } from '@/components/redesign/SuaPraca';
import { Revelar } from '@/components/redesign/Revelar';

export const dynamic = 'force-dynamic';

type Cotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string };
type LinhaUf = { tipo: string; uf: string; valor: number; variacao_pct: number | null; data_referencia: string };
type LinhaPraca = { tipo: string; praca: string; uf: string; valor: number; variacao_pct: number | null; valor_prazo: number | null; data_referencia: string };

const MERCADO: Record<string, { unLabel: string; casas: number }> = {
  dolar: { unLabel: 'comercial', casas: 4 },
  euro: { unLabel: 'comercial', casas: 4 },
  ouro: { unLabel: 'por grama · 999', casas: 2 },
  ouro18k: { unLabel: 'por grama · 750', casas: 2 },
  ibovespa: { unLabel: 'índice B3 · pontos', casas: 0 },
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

  const [{ data: atuais }, { data: porUf }, { data: porPraca }, { data: hist }, { data: reportes }] = await Promise.all([
    supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct, data_referencia'),
    supabase.from('cotacoes_uf').select('tipo, uf, valor, variacao_pct, data_referencia'),
    supabase.from('cotacoes_praca').select('tipo, praca, uf, valor, variacao_pct, valor_prazo, data_referencia'),
    supabase
      .from('cotacoes_historico')
      .select('tipo, valor, data_referencia')
      .gte('data_referencia', trintaDias)
      .order('data_referencia', { ascending: true }),
    supabase
      .from('reportes')
      .select('produto, municipio, valor')
      .eq('status', 'aprovado')
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
  // O Postgres devolve na ordem que quiser: sem isto, um card lista PA/MT/TO/GO e o
  // do lado GO/PA/MT/TO — e o produtor perde a comparação entre categorias.
  for (const [tipo, ufs] of ufsPorTipo) ufsPorTipo.set(tipo, ordenarPorUf(ufs));

  // Boi e vaca vêm por PRAÇA (Scot): Marabá, Redenção, Paragominas, Cuiabá…
  const pracasPorTipo = new Map<string, PrecoPracaUI[]>();
  for (const l of ((porPraca ?? []) as LinhaPraca[])) {
    const arr = pracasPorTipo.get(l.tipo) ?? [];
    arr.push({
      praca: l.praca,
      uf: l.uf,
      valor: Number(l.valor),
      variacaoPct: l.variacao_pct === null ? null : Number(l.variacao_pct),
      ...(l.valor_prazo === null ? {} : { valorPrazo: Number(l.valor_prazo) }),
    });
    pracasPorTipo.set(l.tipo, arr);
    const atual = refPorTipo.get(l.tipo);
    if (!atual || l.data_referencia > atual) refPorTipo.set(l.tipo, l.data_referencia);
  }
  // Mesma razão da ordem das UFs: agrupa por estado, com a praça de casa (PA) primeiro.
  for (const [tipo, pracas] of pracasPorTipo) pracasPorTipo.set(tipo, ordenarPorUf(pracas));

  // As cidades da praça, agora para TODA a porteira (antes: só o boi). Valor típico
  // (mediana) dos reportes aprovados de 7 dias; cidade sem reporte vira convite.
  const aprovados = ((reportes ?? []) as ReporteAprovado[]).map((r) => ({
    produto: r.produto,
    municipio: r.municipio,
    valor: Number(r.valor),
  }));
  const cidadesPorTipo = new Map<string, PrecoCidadeUI[]>(
    PORTEIRA.map((tipo) => [tipo, cidadesDoProduto(aprovados, tipo)]),
  );

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
      moeda: !NAO_E_MOEDA.has(c.tipo),
    }));

  const temPorteira = PORTEIRA.some(
    (t) => (ufsPorTipo.get(t) ?? []).length > 0 || (pracasPorTipo.get(t) ?? []).length > 0,
  );
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
              Atualizado {fmtHora.format(agora)}, fontes Scot, CONAB, BCB, B3, CoinGecko
            </div>
          </div>
          <SuaPraca />
        </div>
        <div className="photo">
          {/* Foto escolhida pelo dono do projeto. Sem nome de animal nem crédito de autoria:
              a origem não é conhecida, e atribuir a quem não é seria mentira. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/hero-boi.jpg" alt="Touro nelore no pasto" />
          <div className="overlay" />
          <span className="tag">Nelore · Touro</span>
        </div>
      </section>

      {temPorteira && (
        <section className="section">
          <div className="section-head">
            <div className="t">Na porteira</div>
            <div className="line" />
            <div className="meta">
              Preço de cada praça<span className="pill">Scot · CONAB</span>Gado e grão
            </div>
          </div>
          <div className="pcards">
            {PORTEIRA.map((tipo, i) => {
              const precos = ufsPorTipo.get(tipo) ?? [];
              const pracas = pracasPorTipo.get(tipo);
              const ref = refPorTipo.get(tipo);
              if (precos.length === 0 && !pracas?.length) return null;
              if (!ref) return null;
              return (
                // Todos os seis têm o mesmo tamanho e ficam lado a lado: preços em cima,
                // Termômetro embaixo. O boi não é mais a faixa larga da linha inteira.
                <Revelar key={tipo} delay={i * 0.08}>
                  <CardPorteira
                    tipo={tipo}
                    titulo={TITULOS[tipo] ?? tipo}
                    unLabel={UNIDADE_PORTEIRA[tipo]}
                    rodape={rodapeDaFonte(tipo, ref)}
                    precos={precos}
                    pracas={pracas?.length ? pracas : undefined}
                    cidades={cidadesPorTipo.get(tipo)}
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
              Câmbio, ouro, bolsa e cripto<span className="pill">BCB · B3 · CoinGecko</span>Diário
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
