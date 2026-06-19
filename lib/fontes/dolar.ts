import type { Cotacao } from '@/types/cotacao';

const URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';

// A AwesomeAPI devolve create_date no horário de Brasília (BRT), sem offset.
// O Brasil não usa horário de verão desde 2019, então o offset é fixo em -03:00.
// Sem isso, `new Date('...T09:00:00')` seria interpretado como hora local do
// runtime (UTC na Vercel), deslocando o timestamp em 3h.
const OFFSET_BRT = '-03:00';

export async function buscarDolar(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(URL);
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const body = (await res.json()) as { USDBRL?: { bid?: string; create_date?: string } };
  const raw = body?.USDBRL;
  const valor = Number(raw?.bid);

  if (!raw) {
    throw new Error('Resposta da AwesomeAPI inválida: objeto USDBRL ausente');
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta da AwesomeAPI inválida: bid ausente ou não positivo');
  }
  if (!raw.create_date) {
    throw new Error('Resposta da AwesomeAPI inválida: create_date ausente');
  }

  return {
    tipo: 'dolar',
    valor,
    unidade: 'R$',
    fonte: 'awesomeapi',
    dataReferencia: new Date(raw.create_date.replace(' ', 'T') + OFFSET_BRT).toISOString(),
  };
}
