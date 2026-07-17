import { describe, it, expect } from 'vitest';
import { TITULOS, ORDEM_PAINEL, PORTEIRA, PECUARIA, LEGENDAS, NAO_E_MOEDA, prazoDesatualizadoMs } from '@/lib/tipos-ui';

describe('tipos-ui', () => {
  it('tem título para os 11 tipos', () => {
    expect(TITULOS).toMatchObject({
      boi: 'Boi gordo', vaca: 'Vaca gorda', novilha: 'Novilha', bezerro: 'Bezerro',
      soja: 'Soja', milho: 'Milho',
      dolar: 'Dólar', euro: 'Euro',
      ouro: 'Ouro',
      bitcoin: 'Bitcoin', ethereum: 'Ethereum',
    });
    // O ouro 18k saiu a pedido do dono (17/07/2026): o Mercado mostra só o Ouro.
    expect(TITULOS).not.toHaveProperty('ouro18k');
  });

  it('a porteira é o gado e depois a lavoura', () => {
    expect(PECUARIA).toEqual(['boi', 'vaca', 'novilha', 'bezerro']);
    expect(PORTEIRA).toEqual(['boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho']);
  });

  it('ordena o painel com a porteira primeiro e cripto ao fim do mercado', () => {
    expect(ORDEM_PAINEL).toEqual([
      'boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho',
      'dolar', 'euro', 'ouro', 'ibovespa', 'bitcoin', 'ethereum',
    ]);
  });

  it('o Ibovespa é o único que não é dinheiro (é ponto)', () => {
    expect(NAO_E_MOEDA.has('ibovespa')).toBe(true);
    expect(NAO_E_MOEDA.has('dolar')).toBe(false);
    expect(NAO_E_MOEDA.has('bitcoin')).toBe(false);
  });

  it('legenda da porteira diz o recorte certo e credita quem apurou', () => {
    // Boi e vaca vêm praça a praça (Scot pesquisa Marabá, Redenção…); grãos, por
    // estado (a CONAB só publica assim). A legenda não pode prometer o que não é.
    expect(LEGENDAS.boi).toBe('preço por praça · Scot Consultoria');
    expect(LEGENDAS.vaca).toBe('preço por praça · Scot Consultoria');
    expect(LEGENDAS.novilha).toBe('preço por estado · Scot Consultoria');
    expect(LEGENDAS.bezerro).toBe('preço por estado · Scot Consultoria');
    expect(LEGENDAS.milho).toBe('preço por estado · CONAB');
    expect(LEGENDAS.soja).toBe('preço por estado · CONAB');
    expect(LEGENDAS.dolar).toBeUndefined();
  });

  it('prazo de desatualizado: 48h para diárias, 5 dias para a Scot, 10 para a CONAB', () => {
    expect(prazoDesatualizadoMs('dolar')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('bitcoin')).toBe(48 * 60 * 60 * 1000);
    // A Scot publica em dia útil: 5 dias cobre fim de semana e feriado.
    expect(prazoDesatualizadoMs('vaca')).toBe(5 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('bezerro')).toBe(5 * 24 * 60 * 60 * 1000);
    // O boi saiu da CONAB (semanal) para a Scot (diária) na fatia 17: 10 dias de
    // tolerância esconderiam um preço parado há mais de uma semana.
    expect(prazoDesatualizadoMs('boi')).toBe(5 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('milho')).toBe(10 * 24 * 60 * 60 * 1000);
  });
});
