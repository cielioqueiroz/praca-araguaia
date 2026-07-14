import type { Cotacao } from '@/types/cotacao';

const URL_OURO = 'https://api.gold-api.com/price/XAU';
const URL_USD = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL';

// O gold-api cota a ONÇA TROY; o mercado brasileiro fala em grama.
const GRAMAS_POR_ONCA_TROY = 31.1034768;

// O gold-api cota ouro FINO (999/1000) — é o nosso 24k.
// 18k é definição de liga, não outra cotação: 18 partes de ouro em 24 = 750/1000.
// Por isso o 18k é derivado do 24k, e não buscado numa segunda fonte.
export const TEOR_18K = 18 / 24; // 0,75

// Ouro em R$ por grama: (preço da onça em USD × USD-BRL) ÷ gramas da onça troy.
// gold-api: { price (USD), updatedAt }. Frankfurter: { rates: { BRL } }.
async function gramaDeOuro24k(
  fetchImpl: typeof fetch,
): Promise<{ valor: number; dataReferencia: string }> {
  const [resOuro, resUsd] = await Promise.all([fetchImpl(URL_OURO), fetchImpl(URL_USD)]);
  if (!resOuro.ok) throw new Error(`gold-api respondeu ${resOuro.status}`);
  if (!resUsd.ok) throw new Error(`Frankfurter respondeu ${resUsd.status}`);

  const ouro = (await resOuro.json()) as { price?: number; updatedAt?: string };
  const usd = (await resUsd.json()) as { rates?: { BRL?: number } };

  const precoUsd = Number(ouro?.price);
  const usdBrl = Number(usd?.rates?.BRL);
  if (!Number.isFinite(precoUsd) || precoUsd <= 0) {
    throw new Error('Resposta do gold-api inválida: price ausente ou não positivo');
  }
  if (!Number.isFinite(usdBrl) || usdBrl <= 0) {
    throw new Error('USD-BRL inválido para converter o ouro');
  }

  return {
    valor: (precoUsd * usdBrl) / GRAMAS_POR_ONCA_TROY,
    dataReferencia: ouro.updatedAt ? new Date(ouro.updatedAt).toISOString() : new Date().toISOString(),
  };
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Ouro 24k (fino): o grama do metal puro. */
export async function buscarOuro(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const { valor, dataReferencia } = await gramaDeOuro24k(fetchImpl);
  return { tipo: 'ouro', valor: centavos(valor), unidade: 'R$/g', fonte: 'gold-api', dataReferencia };
}

/** Ouro 18k: o mesmo grama, com 75% de ouro na liga (750/1000). */
export async function buscarOuro18k(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const { valor, dataReferencia } = await gramaDeOuro24k(fetchImpl);
  return {
    tipo: 'ouro18k',
    valor: centavos(valor * TEOR_18K),
    unidade: 'R$/g',
    fonte: 'gold-api',
    dataReferencia,
  };
}
