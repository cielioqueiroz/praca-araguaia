import type { Cotacao, PontoHistorico } from '@/types/cotacao';

// Ibovespa (^BVSP) — o índice da B3, em pontos.
//
// Fonte: a API de chart do Yahoo Finance, que responde sem chave e traz, na mesma
// resposta, o valor de agora e a série diária (usada no backfill/sparkline). A brapi
// (a alternativa brasileira) passou a exigir token, e o projeto só usa fonte grátis.
//
// Atenção à unidade: Ibovespa é PONTO, não real. Formatar como "R$" seria mentira —
// por isso o painel e o boletim tratam o tipo 'ibovespa' com sufixo 'pts' e sem R$.

const URL = (dias: number) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=${dias}d`;

const TTL_MS = 10 * 60 * 1000;

type Resposta = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: unknown;
  };
};

type Leitura = { valor: number; dataReferencia: string; historico: PontoHistorico[] };

let cache: { quando: number; leitura: Leitura } | null = null;

export function resetCacheIbovespa(): void {
  cache = null;
}

async function carregar(dias: number, fetchImpl: typeof fetch): Promise<Leitura> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.leitura;

  const res = await fetchImpl(URL(dias), {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; PracaAraguaia/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance respondeu ${res.status}`);

  const body = (await res.json()) as Resposta;
  const r = body.chart?.result?.[0];
  const valor = Number(r?.meta?.regularMarketPrice);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta do Yahoo inválida: sem regularMarketPrice do ^BVSP');
  }

  const segundos = r?.meta?.regularMarketTime;
  const dataReferencia = new Date((segundos ? segundos : Date.now() / 1000) * 1000).toISOString();

  // Pregão sem fechamento (feriado, dia em curso) vem como null: some, não vira zero.
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const historico: PontoHistorico[] = ts.flatMap((t, i) => {
    const c = closes[i];
    return typeof c === 'number' && Number.isFinite(c)
      ? [{ data: new Date(t * 1000).toISOString(), valor: Math.round(c * 100) / 100 }]
      : [];
  });

  const leitura = { valor: Math.round(valor * 100) / 100, dataReferencia, historico };
  cache = { quando: Date.now(), leitura };
  return leitura;
}

export async function buscarIbovespa(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const { valor, dataReferencia } = await carregar(90, fetchImpl);
  return { tipo: 'ibovespa', valor, unidade: 'pts', fonte: 'b3/yahoo', dataReferencia };
}

/** Série diária de ~90 dias — mesma resposta da coleta, sem uma segunda ida à rede. */
export async function buscarHistoricoIbovespa(fetchImpl: typeof fetch = fetch): Promise<PontoHistorico[]> {
  const { historico } = await carregar(90, fetchImpl);
  if (historico.length === 0) throw new Error('Yahoo sem histórico do ^BVSP');
  return historico;
}
