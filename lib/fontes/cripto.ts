import type { Cotacao, PontoHistorico } from '@/types/cotacao';

export type MoedaCripto = 'bitcoin' | 'ethereum';

const MOEDAS: MoedaCripto[] = ['bitcoin', 'ethereum'];
const URL_PRECO = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=brl';
const urlHistorico = (moeda: MoedaCripto) =>
  `https://api.coingecko.com/api/v3/coins/${moeda}/market_chart?vs_currency=brl&days=90&interval=daily`;

// O plano grátis da CoinGecko limita requisições por minuto: as duas moedas
// dividem a mesma resposta dentro de uma coleta (igual ao arquivo da CONAB).
const TTL_MS = 10 * 60 * 1000;

type Precos = Record<MoedaCripto, number>;
let cache: { quando: number; precos: Precos } | null = null;

export function resetCacheCripto(): void {
  cache = null;
}

async function carregar(fetchImpl: typeof fetch): Promise<Precos> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.precos;

  const res = await fetchImpl(URL_PRECO);
  if (!res.ok) throw new Error(`CoinGecko respondeu ${res.status}`);
  const body = (await res.json()) as Partial<Record<MoedaCripto, { brl?: number }>>;

  const precos = {} as Precos;
  for (const moeda of MOEDAS) {
    const valor = Number(body?.[moeda]?.brl);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error(`CoinGecko sem preço em BRL para ${moeda}`);
    }
    precos[moeda] = valor;
  }

  cache = { quando: Date.now(), precos };
  return precos;
}

async function buscar(moeda: MoedaCripto, fetchImpl: typeof fetch): Promise<Cotacao> {
  const precos = await carregar(fetchImpl);
  return {
    tipo: moeda,
    valor: precos[moeda],
    unidade: 'R$',
    fonte: 'coingecko',
    dataReferencia: new Date().toISOString(),
  };
}

export const buscarBitcoin = (fetchImpl: typeof fetch = fetch) => buscar('bitcoin', fetchImpl);
export const buscarEthereum = (fetchImpl: typeof fetch = fetch) => buscar('ethereum', fetchImpl);

// Série diária dos últimos 90 dias: a CoinGecko devolve [ms, preço].
export async function buscarHistoricoCripto(
  moeda: MoedaCripto,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const res = await fetchImpl(urlHistorico(moeda));
  if (!res.ok) throw new Error(`CoinGecko (histórico de ${moeda}) respondeu ${res.status}`);

  const body = (await res.json()) as { prices?: [number, number][] };
  const pontos = (body.prices ?? [])
    .filter(([ms, valor]) => Number.isFinite(ms) && Number.isFinite(valor) && valor > 0)
    .map(([ms, valor]) => ({
      data: new Date(ms).toISOString(),
      valor: Math.round(valor * 100) / 100,
    }));

  if (pontos.length === 0) throw new Error(`CoinGecko sem histórico de ${moeda}`);
  return pontos;
}
