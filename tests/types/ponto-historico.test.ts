import { describe, it, expect } from 'vitest';
import type { PontoHistorico } from '@/types/cotacao';

describe('PontoHistorico', () => {
  it('aceita um ponto bem formado', () => {
    const p: PontoHistorico = { data: '2026-06-19T03:00:00.000Z', valor: 5.1382 };
    expect(p.valor).toBeCloseTo(5.1382);
    expect(typeof p.data).toBe('string');
  });
});
