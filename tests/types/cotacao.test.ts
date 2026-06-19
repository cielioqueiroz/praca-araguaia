import { describe, it, expect } from 'vitest';
import type { Cotacao, CotacaoSalva } from '@/types/cotacao';

describe('Cotacao', () => {
  it('aceita um objeto bem formado', () => {
    const c: Cotacao = {
      tipo: 'dolar', valor: 5.43, unidade: 'R$',
      fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
    };
    const salva: CotacaoSalva = { ...c, variacaoPct: 1.2 };
    expect(salva.tipo).toBe('dolar');
    expect(salva.variacaoPct).toBe(1.2);
  });
});
