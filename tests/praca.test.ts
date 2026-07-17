import { describe, it, expect } from 'vitest';
import {
  municipioMaisProximo,
  ufDaSigla,
  ordenarPorPraca,
  NOME_UF,
  ORDEM_UF,
  UFS_ARAGUAIA,
} from '@/lib/praca';

describe('municipioMaisProximo', () => {
  it('acha Redenção a partir de coordenadas vizinhas', () => {
    const m = municipioMaisProximo(-8.03, -50.03);
    expect(m?.nome).toBe('Redenção');
    expect(m?.uf).toBe('PA');
  });

  it('acha Confresa e devolve a UF', () => {
    const m = municipioMaisProximo(-10.6, -51.5);
    expect(m?.nome).toBe('Confresa');
    expect(m?.uf).toBe('MT');
  });

  it('devolve null para quem está longe da praça (São Paulo)', () => {
    expect(municipioMaisProximo(-23.55, -46.63)).toBeNull();
  });

  it('devolve null para coordenada inválida', () => {
    expect(municipioMaisProximo(Number.NaN, -50)).toBeNull();
  });
});

describe('ufDaSigla', () => {
  it('aceita a sigla da praça, em qualquer caixa', () => {
    expect(ufDaSigla('pa')).toBe('PA');
    expect(ufDaSigla('MT')).toBe('MT');
  });

  it('rejeita UF de fora da praça', () => {
    expect(ufDaSigla('SP')).toBeNull();
    expect(ufDaSigla('')).toBeNull();
  });
});

describe('NOME_UF', () => {
  it('tem o nome por extenso das UFs da praça e das de referência', () => {
    expect(NOME_UF).toEqual({
      PA: 'Pará', MT: 'Mato Grosso', TO: 'Tocantins', GO: 'Goiás',
      BA: 'Bahia', MA: 'Maranhão', PE: 'Pernambuco',
    });
  });

  it('o Araguaia vem antes da referência na ordem de exibição', () => {
    // O site é a praça do Vale: quem abre o card acha o preço de casa no topo.
    expect(ORDEM_UF.slice(0, 4)).toEqual(UFS_ARAGUAIA);
    expect(ORDEM_UF.slice(4)).toEqual(['BA', 'MA', 'PE']);
  });
});

describe('ordenarPorPraca', () => {
  it('ordena pela UF e desempata pelo nome da praça', () => {
    // Só por UF, Marabá e Redenção trocavam de lugar entre acessos: o Postgres
    // devolve na ordem que quiser, e o produtor não compara preço que dança.
    const fora = [
      { uf: 'BA', praca: 'Sul' },
      { uf: 'PA', praca: 'Redenção' },
      { uf: 'PA', praca: 'Marabá' },
      { uf: 'TO', praca: 'Norte' },
    ];
    expect(ordenarPorPraca(fora).map((p) => `${p.uf} ${p.praca}`)).toEqual([
      'PA Marabá', 'PA Redenção', 'TO Norte', 'BA Sul',
    ]);
  });

  it('é determinística: a mesma entrada embaralhada dá a mesma saída', () => {
    const itens = [
      { uf: 'PA', praca: 'Paragominas' },
      { uf: 'PA', praca: 'Marabá' },
      { uf: 'MA', praca: 'Oeste' },
    ];
    const a = ordenarPorPraca(itens).map((p) => p.praca);
    const b = ordenarPorPraca([...itens].reverse()).map((p) => p.praca);
    expect(a).toEqual(b);
  });
});
