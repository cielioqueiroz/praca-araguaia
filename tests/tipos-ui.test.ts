import { describe, it, expect } from 'vitest';
import { TITULOS, ORDEM_PAINEL, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

describe('tipos-ui', () => {
  it('tem título para os 6 tipos', () => {
    expect(TITULOS).toMatchObject({
      boi: 'Boi gordo', soja: 'Soja', milho: 'Milho',
      dolar: 'Dólar', euro: 'Euro', ouro: 'Ouro',
    });
  });

  it('ordena o painel com commodities primeiro', () => {
    expect(ORDEM_PAINEL).toEqual(['boi', 'soja', 'milho', 'dolar', 'euro', 'ouro']);
  });

  it('legenda explicita a média regional só para as commodities', () => {
    expect(LEGENDAS.boi).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.soja).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.milho).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.dolar).toBeUndefined();
  });

  it('prazo de desatualizado: 48h para diárias, 10 dias para semanais', () => {
    expect(prazoDesatualizadoMs('dolar')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('boi')).toBe(10 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('milho')).toBe(10 * 24 * 60 * 60 * 1000);
  });
});
