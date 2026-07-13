import type { Cotacao } from '@/types/cotacao';

const URL_OURO = 'https://api.gold-api.com/price/XAU';
const URL_USD = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL';

// O gold-api cota a ONÇA TROY; o mercado brasileiro fala em grama.
const GRAMAS_POR_ONCA_TROY = 31.1034768;

// Ouro em R$ por grama: (preço da onça em USD × USD-BRL) ÷ gramas da onça troy.
// gold-api: { price (USD), updatedAt }. Frankfurter: { rates: { BRL } }.
export async function buscarOuro(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
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

  const valor = Math.round(((precoUsd * usdBrl) / GRAMAS_POR_ONCA_TROY) * 100) / 100;
  return {
    tipo: 'ouro',
    valor,
    unidade: 'R$/g',
    fonte: 'gold-api',
    dataReferencia: ouro.updatedAt ? new Date(ouro.updatedAt).toISOString() : new Date().toISOString(),
  };
}
