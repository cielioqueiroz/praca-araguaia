import { describe, it, expect } from 'vitest';
import { FONTES, FONTES_HISTORICO } from '@/lib/fontes/registry';

describe('registry de fontes', () => {
  it('tem as 8 cotações na coleta diária', () => {
    expect(Object.keys(FONTES).sort()).toEqual([
      'bitcoin', 'boi', 'dolar', 'ethereum', 'euro', 'milho', 'ouro', 'soja',
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
