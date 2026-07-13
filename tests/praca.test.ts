import { describe, it, expect } from 'vitest';
import { municipioMaisProximo, ufDaSigla, NOME_UF } from '@/lib/praca';

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
  it('tem o nome por extenso das quatro UFs da praça', () => {
    expect(NOME_UF).toEqual({ PA: 'Pará', MT: 'Mato Grosso', TO: 'Tocantins', GO: 'Goiás' });
  });
});
