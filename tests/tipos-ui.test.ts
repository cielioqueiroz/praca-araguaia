import { describe, it, expect } from 'vitest';
import { TITULOS, ORDEM_PAINEL, PORTEIRA, PECUARIA, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

describe('tipos-ui', () => {
  it('tem título para os 12 tipos', () => {
    expect(TITULOS).toMatchObject({
      boi: 'Boi gordo', vaca: 'Vaca gorda', novilha: 'Novilha', bezerro: 'Bezerro',
      soja: 'Soja', milho: 'Milho',
      dolar: 'Dólar', euro: 'Euro',
      ouro: 'Ouro 24k', ouro18k: 'Ouro 18k',
      bitcoin: 'Bitcoin', ethereum: 'Ethereum',
    });
  });

  it('a porteira é o gado e depois a lavoura', () => {
    expect(PECUARIA).toEqual(['boi', 'vaca', 'novilha', 'bezerro']);
    expect(PORTEIRA).toEqual(['boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho']);
  });

  it('ordena o painel com a porteira primeiro e cripto ao fim do mercado', () => {
    expect(ORDEM_PAINEL).toEqual([
      'boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho',
      'dolar', 'euro', 'ouro', 'ouro18k', 'bitcoin', 'ethereum',
    ]);
  });

  it('legenda da porteira aponta o preço por estado e credita quem apurou', () => {
    expect(LEGENDAS.boi).toBe('preço por estado · CONAB');
    expect(LEGENDAS.milho).toBe('preço por estado · CONAB');
    // Vaca/novilha/bezerro não são da CONAB — ela não publica essas categorias.
    expect(LEGENDAS.vaca).toBe('preço por estado · Datagro');
    expect(LEGENDAS.novilha).toBe('preço por estado · Datagro');
    expect(LEGENDAS.bezerro).toBe('preço por estado · Scot Consultoria');
    expect(LEGENDAS.dolar).toBeUndefined();
  });

  it('prazo de desatualizado: 48h para diárias, 5 dias para os indicadores, 10 para a CONAB', () => {
    expect(prazoDesatualizadoMs('dolar')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro18k')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('bitcoin')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('vaca')).toBe(5 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('bezerro')).toBe(5 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('boi')).toBe(10 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('milho')).toBe(10 * 24 * 60 * 60 * 1000);
  });
});
