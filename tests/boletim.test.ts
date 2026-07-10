import { describe, it, expect } from 'vitest';
import { montarBoletim } from '@/lib/boletim';

const linha = (tipo: string, valor: number, unidade: string, variacao_pct: number | null) => ({
  tipo, valor, unidade, variacao_pct,
});

describe('montarBoletim', () => {
  it('ordena pelo painel (commodities primeiro) e joga tipo desconhecido para o fim', () => {
    const b = montarBoletim([
      linha('dolar', 5.19, 'R$', 0.5),
      linha('xpto', 1, 'R$', null),
      linha('boi', 326.96, 'R$/@', -1.54),
    ]);
    expect(b.itens.map((i) => i.titulo)).toEqual(['Boi gordo', 'Dólar', 'xpto']);
  });

  it('formata valor pt-BR com unidade compacta depois do número', () => {
    const b = montarBoletim([
      linha('boi', 326.96, 'R$/@', null),
      linha('soja', 113.7, 'R$/sc', null),
      linha('dolar', 5.1945, 'R$', null),
      linha('ouro', 21222.3, 'R$', null),
    ]);
    expect(b.itens[0].valorFmt).toBe('326,96 @');
    expect(b.itens[1].valorFmt).toBe('113,70 SC 60kg');
    expect(b.itens[2].valorFmt).toBe('R$ 5,1945');
    expect(b.itens[3].valorFmt).toBe('R$ 21.222,30 /g');
  });

  it('monta variação com direção e texto; null fica sem variação', () => {
    const b = montarBoletim([
      linha('dolar', 5, 'R$', 0.4),
      linha('euro', 6, 'R$', -1.54),
      linha('ouro', 21000, 'R$', null),
    ]);
    expect(b.itens[0].variacao).toEqual({ texto: '0,4%', direcao: 'alta' });
    expect(b.itens[1].variacao).toEqual({ texto: '1,54%', direcao: 'baixa' });
    expect(b.itens[2].variacao).toBeUndefined();
  });

  it('variação 0 conta como alta (mesma regra do painel)', () => {
    const b = montarBoletim([linha('dolar', 5, 'R$', 0)]);
    expect(b.itens[0].variacao).toEqual({ texto: '0%', direcao: 'alta' });
  });

  it('legenda regional só nas commodities', () => {
    const b = montarBoletim([linha('boi', 326, 'R$/@', null), linha('dolar', 5, 'R$', null)]);
    expect(b.itens[0].legenda).toBe('média MT/PA/TO/GO · CONAB');
    expect(b.itens[1].legenda).toBeUndefined();
  });

  it('data por extenso em pt-BR no fuso do Araguaia', () => {
    const b = montarBoletim([], new Date('2026-07-03T14:00:00Z'));
    expect(b.dataExtenso).toBe('sexta-feira, 3 de julho de 2026');
  });

  it('lista vazia devolve itens vazios sem quebrar', () => {
    const b = montarBoletim([]);
    expect(b.itens).toEqual([]);
    expect(b.dataExtenso.length).toBeGreaterThan(0);
  });
});
