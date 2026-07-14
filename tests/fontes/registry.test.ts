import { describe, it, expect } from 'vitest';
import { FONTES, FONTES_HISTORICO } from '@/lib/fontes/registry';

describe('registry de fontes', () => {
  it('tem as 12 cotações na coleta diária', () => {
    expect(Object.keys(FONTES).sort()).toEqual([
      'bezerro', 'bitcoin', 'boi', 'dolar', 'ethereum', 'euro',
      'milho', 'novilha', 'ouro', 'ouro18k', 'soja', 'vaca',
    ]);
  });

  // Vaca/novilha/bezerro e o ouro 18k não entram no backfill: os indicadores não
  // publicam série histórica grátis, e o 18k é derivado do 24k. Eles acumulam
  // histórico a partir da primeira coleta.
  it('backfill só tem quem tem série histórica de graça', () => {
    expect(FONTES_HISTORICO.map((f) => f.tipo).sort()).toEqual([
      'bitcoin', 'boi', 'dolar', 'ethereum', 'euro', 'milho', 'soja',
    ]);
  });

  it('tem as commodities da CONAB no backfill', () => {
    const conab = FONTES_HISTORICO.filter((f) => f.fonte === 'conab').map((f) => f.tipo);
    expect(conab.sort()).toEqual(['boi', 'milho', 'soja']);
  });

  it('tem as criptomoedas no backfill', () => {
    const cripto = FONTES_HISTORICO.filter((f) => f.fonte === 'coingecko').map((f) => f.tipo);
    expect(cripto.sort()).toEqual(['bitcoin', 'ethereum']);
  });
});
