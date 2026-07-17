import type { Cotacao } from '@/types/cotacao';

const URL_OURO = 'https://api.gold-api.com/price/XAU';
const URL_USD = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL';

// O gold-api cota a ONÇA TROY; o mercado brasileiro fala em grama.
const GRAMAS_POR_ONCA_TROY = 31.1034768;

// O gold-api cota ouro FINO (999/1000) — o grama do metal puro, que é o preço de
// mercado que o dono quer ver. (Havia um "ouro 18k" derivado daqui por 0,75; saiu a
// pedido do dono em 17/07/2026 — o Mercado mostra só o Ouro, em R$/grama.)

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

/** Ouro fino (grama do metal puro) — a cotação de mercado, em R$/g. */
export async function buscarOuro(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const { valor, dataReferencia } = await gramaDeOuro24k(fetchImpl);
  return { tipo: 'ouro', valor: centavos(valor), unidade: 'R$/g', fonte: 'gold-api', dataReferencia };
}
