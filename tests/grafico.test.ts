import { describe, it, expect } from 'vitest';
import { filtrarPorPeriodo } from '@/lib/grafico';
import type { PontoHistorico } from '@/types/cotacao';

const agora = new Date('2026-06-30T12:00:00.000Z');
function ponto(diasAtras: number): PontoHistorico {
  return { data: new Date(agora.getTime() - diasAtras * 86400000).toISOString(), valor: 5 + diasAtras / 100 };
}

describe('filtrarPorPeriodo', () => {
  const pontos = [ponto(89), ponto(40), ponto(20), ponto(5), ponto(1)];

  it('7d retorna só os últimos 7 dias', () => {
    expect(filtrarPorPeriodo(pontos, 7, agora)).toHaveLength(2); // 5 e 1
  });

  it('30d inclui mais que 7d e menos que 90d', () => {
    expect(filtrarPorPeriodo(pontos, 30, agora)).toHaveLength(3); // 20,5,1
  });

  it('90d retorna todos', () => {
    expect(filtrarPorPeriodo(pontos, 90, agora)).toHaveLength(5);
  });

  it('lista vazia retorna vazia', () => {
    expect(filtrarPorPeriodo([], 30, agora)).toEqual([]);
  });
});
