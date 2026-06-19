import type { Cotacao } from '@/types/cotacao';

const URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';

export async function buscarDolar(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(URL);
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const body = (await res.json()) as { USDBRL?: { bid?: string; create_date?: string } };
  const raw = body?.USDBRL;
  const valor = Number(raw?.bid);

  if (!raw || !Number.isFinite(valor) || valor <= 0) {
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
    dataReferencia: new Date(raw.create_date.replace(' ', 'T')).toISOString(),
  };
}
