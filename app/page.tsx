import { createPublicClient } from '@/lib/supabase/public';
import { TITULOS, ORDEM_PAINEL, prazoDesatualizadoMs } from '@/lib/tipos-ui';
import { CardCommodity } from '@/components/redesign/CardCommodity';

export const dynamic = 'force-dynamic';

type Cotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string };

const CONFIG: Record<string, { unLabel: string; fonteLabel: string; casas: number; grupo: 'porteira' | 'mercado' }> = {
  boi: { unLabel: 'R$ / arroba · @', fonteLabel: 'CONAB · MT/PA/TO/GO', casas: 2, grupo: 'porteira' },
  soja: { unLabel: 'R$ / saca 60 kg', fonteLabel: 'CONAB · MT/PA/TO/GO', casas: 2, grupo: 'porteira' },
  milho: { unLabel: 'R$ / saca 60 kg', fonteLabel: 'CONAB · MT/PA/TO/GO', casas: 2, grupo: 'porteira' },
  dolar: { unLabel: 'R$ · comercial', fonteLabel: 'B3 · PTAX', casas: 4, grupo: 'mercado' },
  euro: { unLabel: 'R$ · comercial', fonteLabel: 'B3 · PTAX', casas: 4, grupo: 'mercado' },
  ouro: { unLabel: 'R$ / grama · BCB', fonteLabel: 'BCB · ouro ativo', casas: 2, grupo: 'mercado' },
};

const cfg = (tipo: string) => CONFIG[tipo] ?? { unLabel: '', fonteLabel: '', casas: 2, grupo: 'mercado' as const };
const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Araguaina' });

export default async function Home() {
  const supabase = createPublicClient();
  const { data } = await supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct, data_referencia');

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hist } = await supabase
    .from('cotacoes_historico')
    .select('tipo, valor, data_referencia')
    .gte('data_referencia', desde)
    .order('data_referencia', { ascending: true });
  const historicoPorTipo = new Map<string, number[]>();
  for (const h of hist ?? []) {
    const t = h.tipo as string;
    const arr = historicoPorTipo.get(t) ?? [];
    arr.push(Number(h.valor));
    historicoPorTipo.set(t, arr);
  }

  const cotacoes = ((data ?? []) as Cotacao[]).slice().sort((a, b) => posicao(a.tipo) - posicao(b.tipo));
  const porteira = cotacoes.filter((c) => cfg(c.tipo).grupo === 'porteira');
  const mercado = cotacoes.filter((c) => cfg(c.tipo).grupo === 'mercado');

  const card = (c: Cotacao) => (
    <CardCommodity
      key={c.tipo}
      tipo={c.tipo}
      titulo={TITULOS[c.tipo] ?? c.tipo}
      unLabel={cfg(c.tipo).unLabel}
      fonteLabel={cfg(c.tipo).fonteLabel}
      valor={Number(c.valor)}
      variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
      historico={historicoPorTipo.get(c.tipo) ?? []}
      dataReferencia={c.data_referencia}
      desatualizado={Date.now() - new Date(c.data_referencia).getTime() > prazoDesatualizadoMs(c.tipo)}
      casas={cfg(c.tipo).casas}
      variante={cfg(c.tipo).grupo}
    />
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
          <p className="lede">Preços de referência da porteira ao mercado — as praças do Vale do Araguaia, hoje.</p>
          <div className="meta">
            <div className="big">{fmtHoje.format(agora)}</div>
            <div className="mono">Atualizado {fmtHora.format(agora)} · fontes CONAB · B3 · BCB</div>
          </div>
        </div>
        <div className="photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/hero-nelore.jpg" alt="Nelore no pasto do Vale do Araguaia" />
          <div className="overlay" />
          <span className="tag">Nelore · PO</span>
          <span className="credit">Vale do Araguaia · Fazenda de cria</span>
        </div>
      </section>

      {porteira.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t">Na porteira</div>
            <div className="line" />
            <div className="meta">
              Média MT · PA · TO · GO<span className="pill">Fonte · CONAB</span>Semanal
            </div>
          </div>
          <div className="cards">{porteira.map(card)}</div>
        </section>
      )}

      {mercado.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="t">Mercado</div>
            <div className="line" />
            <div className="meta">
              Câmbio e reservas<span className="pill">Fonte · B3 · BCB</span>Diário
            </div>
          </div>
          <div className="cards">{mercado.map(card)}</div>
        </section>
      )}

      {cotacoes.length === 0 && <p className="mono" style={{ marginTop: 48 }}>Ainda sem cotação — rode a coleta.</p>}
    </div>
  );
}
