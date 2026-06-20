import type { Cotacao, PontoHistorico } from '@/types/cotacao';

// Brasil sem horário de verão desde 2019: offset fixo -03:00.
const OFFSET_BRT = '-03:00';
const BASE = 'https://api.frankfurter.dev/v1';

const isoDia = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00${OFFSET_BRT}`).toISOString();

// Euro atual via Frankfurter (BCE). Resposta: { date, rates: { BRL } }.
export async function buscarEuro(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(`${BASE}/latest?base=EUR&symbols=BRL`);
  if (!res.ok) throw new Error(`Frankfurter respondeu ${res.status}`);

  const body = (await res.json()) as { date?: string; rates?: { BRL?: number } };
  const valor = Number(body?.rates?.BRL);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta do Frankfurter inválida: BRL ausente ou não positivo');
  }
  if (!body.date) {
    throw new Error('Resposta do Frankfurter inválida: date ausente');
  }

  return { tipo: 'euro', valor, unidade: 'R$', fonte: 'frankfurter', dataReferencia: isoDia(body.date) };
}

// Série histórica do euro via Frankfurter. Resposta: { rates: { "yyyy-mm-dd": { BRL } } }.
export async function buscarHistoricoEuroFrankfurter(
  dias = 90,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetchImpl(`${BASE}/${dia(inicio)}..${dia(fim)}?base=EUR&symbols=BRL`);
  if (!res.ok) throw new Error(`Frankfurter respondeu ${res.status}`);

  const body = (await res.json()) as { rates?: Record<string, { BRL?: number }> };
  const rates = body?.rates ?? {};
  const pontos = Object.entries(rates).map(([data, r]) => {
    const valor = Number(r?.BRL);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Resposta do Frankfurter inválida: valor não positivo');
    }
    return { data: isoDia(data), valor };
  });
  if (pontos.length === 0) {
    throw new Error('Resposta do Frankfurter inválida: série vazia');
  }
  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}
