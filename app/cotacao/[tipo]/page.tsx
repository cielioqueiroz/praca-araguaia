import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { supabaseRepo } from '@/lib/supabase/repo';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { TITULOS, LEGENDAS, UNIDADE_PORTEIRA, PORTEIRA, creditoFonte, prazoDesatualizadoMs } from '@/lib/tipos-ui';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';
import { faixasDaPorteira } from '@/lib/faixa-porteira';
import { FOTO_COMMODITY } from '@/components/redesign/iconesCommodity';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Araguaina' });

function brl(n: number, casas = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);
}

// Sem isto a aba de /cotacao/boi dizia só "cotações do agro" — o título padrão do
// layout. Quem abre o gráfico do boi e o do dólar lado a lado não distinguia as abas.
// A marca vem do template do layout.
export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const titulo = TITULOS[tipo];
  if (!titulo) return { title: 'Cotação' };
  return {
    title: `${titulo} — cotação`,
    description: `Preço e tendência de ${titulo.toLowerCase()} no Vale do Araguaia: gráfico de 7, 30 e 90 dias, com a fonte e a data de cada apuração.`,
  };
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
  const valor = Number(atual.valor);
  const pct = atual.variacao_pct === null ? null : Number(atual.variacao_pct);
  const velho = Date.now() - new Date(atual.data_referencia).getTime() > prazoDesatualizadoMs(tipo);
  const daPorteira = PORTEIRA.includes(tipo);

  /**
   * Na porteira, o número grande é a FAIXA entre os lugares — nunca o valor de
   * `cotacoes`, que é a média das praças e existe só para desenhar a linha.
   *
   * Antes esta página estampava 334,56 sob a legenda "preço por praça": um número
   * que praça nenhuma pratica, apresentado como se fosse de alguma. A palavra "média"
   * saiu da interface na fatia 15 e não volta pela porta dos fundos.
   */
  const [{ data: pracas }, { data: ufs }] = daPorteira
    ? await Promise.all([
        supabase.from('cotacoes_praca').select('tipo, valor').eq('tipo', tipo),
        supabase.from('cotacoes_uf').select('tipo, valor').eq('tipo', tipo),
      ])
    : [{ data: [] }, { data: [] }];
  const lugares = ((pracas ?? []).length > 0 ? pracas : ufs) ?? [];
  const faixa = faixasDaPorteira(lugares.map((l) => ({ tipo: l.tipo as string, valor: Number(l.valor) })))[0];
  const porPraca = (pracas ?? []).length > 0;

  return (
    <div className="wrap">
      <Link href="/cotacoes" className="pgvolta">
        ← A praça hoje
      </Link>

      <section className={`pghero${FOTO_COMMODITY[tipo] ? ' comretrato' : ''}`}>
        <div>
          <div className="kicker">Cotação de referência</div>
          <h1>{titulo}</h1>
          <p className="lede">
            {daPorteira
              ? 'O preço publicado pela fonte e o caminho que ele fez — para decidir com a tendência, não com o número solto.'
              : 'O número que cerca a fazenda: contexto do que o mercado fez, dia após dia.'}
          </p>
          <div className="pgmeta mono">
            {LEGENDAS[tipo] ?? creditoFonte(tipo) ?? 'cotação de mercado'} · fechamento de{' '}
            {fmtData.format(new Date(atual.data_referencia))}
            {velho && ' · desatualizado'}
          </div>
        </div>
        {/* O retrato do próprio produto, o mesmo recorte que os cartões da porteira já
            usam: a página do boi mostra o boi. Não precisou de foto nova. */}
        {FOTO_COMMODITY[tipo] && (
          <div className={`retrato tipo-${tipo}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO_COMMODITY[tipo]} alt="" aria-hidden="true" />
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div className="t">Agora</div>
          <div className="line" />
          {daPorteira && (
            <div className="meta">
              {/* Aqui é a série regional: o preço de CADA praça está no painel. */}
              Preço de cada praça em<span className="pill">a praça hoje</span>
            </div>
          )}
        </div>

        <div className="cidgado solo">
          <div className="cidcard">
            <div className="ct">{titulo}</div>
            {faixa && faixa.min !== faixa.max ? (
              <>
                <div className="cv tnum">
                  {brl(faixa.min)}
                  <i className="ate">–</i>
                  {brl(faixa.max)}
                </div>
                <div className="cu">
                  {UNIDADE_PORTEIRA[tipo] ?? atual.unidade} · {faixa.lugares}{' '}
                  {porPraca ? (faixa.lugares === 1 ? 'praça' : 'praças') : faixa.lugares === 1 ? 'estado' : 'estados'}
                </div>
              </>
            ) : (
              <>
                <div className="cv tnum">
                  {brl(faixa ? faixa.min : valor, tipo === 'dolar' || tipo === 'euro' ? 4 : 2)}
                </div>
                <div className="cu">{UNIDADE_PORTEIRA[tipo] ?? atual.unidade}</div>
              </>
            )}
            <div className="cp">
              {faixa && faixa.min !== faixa.max ? (
                <Link href="/cotacoes" className="verpracas">
                  Ver o preço de cada {porPraca ? 'praça' : 'estado'} →
                </Link>
              ) : pct === null ? (
                <span className="var-vazia">sem variação publicada</span>
              ) : pct === 0 ? (
                <span className="var flat">
                  <span className="ar">–</span>sem mudança no fechamento
                </span>
              ) : (
                <span className={`var ${pct > 0 ? 'up' : 'down'}`}>
                  <span className="ar">{pct > 0 ? '▲' : '▼'}</span>
                  {Math.abs(pct).toLocaleString('pt-BR')}% no fechamento
                </span>
              )}
            </div>
            <div className="cf mono">
              {fmtData.format(new Date(atual.data_referencia))}
              {velho && ' · desatualizado'}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="t">Tendência</div>
          <div className="line" />
          <div className="meta">
            Últimos dias<span className="pill">7 · 30 · 90</span>
          </div>
        </div>
        <div className="pgcard">
          {pontos.length === 0 ? (
            <p className="cidnota" style={{ marginTop: 0 }}>
              Sem histórico ainda para desenhar a linha.
            </p>
          ) : (
            <GraficoCotacao pontos={pontos} titulo={titulo} unidade={atual.unidade} tipoCotacao={tipo} />
          )}
        </div>
        {daPorteira && (
          <p className="cidnota">
            A linha é a média das praças da região: ela serve para enxergar o CAMINHO do preço, não para fechar
            negócio. O número de cada praça está em <Link href="/cotacoes">a praça hoje</Link>.
          </p>
        )}
      </section>

      {daPorteira && (
        <ConviteDistribuicao
          alvo="cotacoes"
          titulo={[`Como está o ${titulo.toLowerCase()}`, 'na sua praça?']}
          linha="Manda a tendência para quem está pensando em vender esta semana. É de graça e não pede cadastro."
        />
      )}
    </div>
  );
}
