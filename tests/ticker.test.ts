import { describe, it, expect } from 'vitest';
import { montarTicker } from '@/lib/ticker';

describe('montarTicker', () => {
  it('mostra só preços úteis com local nomeado e sem confundir estável com alta', () => {
    const itens = montarTicker([
      { tipo: 'dolar', valor: 5.1072, variacao_pct: 0.11 },
      { tipo: 'boi', local: 'Redenção/PA', valor: 321.26, variacao_pct: 0 },
      { tipo: 'soja', local: 'PA', valor: 140.9, variacao_pct: -0.42 },
      { tipo: 'bitcoin', valor: 326732, variacao_pct: 2 },
    ]);

    expect(itens.map((item) => item.rotulo)).toEqual(['BOI @ Redenção/PA', 'SOJA/sc PA', 'USD']);
    expect(itens[0]).toEqual({ rotulo: 'BOI @ Redenção/PA', valor: '321,26', dir: 'estavel', pct: 'estável' });
    expect(itens[1]).toMatchObject({ dir: 'down', pct: '0,42%' });
    expect(itens[2]).toMatchObject({ valor: '5,1072', dir: 'up', pct: '0,11%' });
  });

  it('não apresenta dado velho ou variação desconhecida como alta', () => {
    const agora = new Date('2026-10-06T20:00:00Z');
    const itens = montarTicker([
      { tipo: 'boi', local: 'Redenção/PA', valor: 320, variacao_pct: 1, data_referencia: '2026-09-28T00:00:00Z' },
      { tipo: 'milho', local: 'PA', valor: 60, variacao_pct: null, data_referencia: '2026-10-02T00:00:00Z' },
    ], agora);
    expect(itens).toEqual([{ rotulo: 'MILHO/sc PA', valor: '60,00', dir: 'sem_dado', pct: '—' }]);
  });
});
