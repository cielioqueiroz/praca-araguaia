import { describe, it, expect } from 'vitest';
import { TITULOS, ORDEM_PAINEL, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

describe('tipos-ui', () => {
  it('tem título para os 8 tipos', () => {
    expect(TITULOS).toMatchObject({
      boi: 'Boi gordo', soja: 'Soja', milho: 'Milho',
      dolar: 'Dólar', euro: 'Euro', ouro: 'Ouro',
      bitcoin: 'Bitcoin', ethereum: 'Ethereum',
    });
  });

  it('ordena o painel com commodities primeiro e cripto ao fim do mercado', () => {
    expect(ORDEM_PAINEL).toEqual([
      'boi', 'soja', 'milho', 'dolar', 'euro', 'ouro', 'bitcoin', 'ethereum',
    ]);
  });

  it('legenda das commodities aponta o preço por estado, nunca uma média', () => {
    expect(LEGENDAS.boi).toBe('preço por estado · CONAB');
    expect(LEGENDAS.soja).toBe('preço por estado · CONAB');
    expect(LEGENDAS.milho).toBe('preço por estado · CONAB');
    expect(LEGENDAS.dolar).toBeUndefined();
  });

  it('prazo de desatualizado: 48h para diárias, 10 dias para semanais', () => {
    expect(prazoDesatualizadoMs('dolar')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('bitcoin')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('boi')).toBe(10 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('milho')).toBe(10 * 24 * 60 * 60 * 1000);
  });
});
