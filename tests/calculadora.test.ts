import { describe, it, expect } from 'vitest';
import { arrobasDeBoi, valorEmReais, sacasParaKg, kgParaSacas } from '@/lib/calculadora';

describe('arrobasDeBoi', () => {
  it('peso vivo × rendimento ÷ 15', () => {
    expect(arrobasDeBoi(480, 50)).toBe(16);
    expect(arrobasDeBoi(500, 52)).toBe(17.33); // 500*0.52/15 = 17.333..
  });
  it('rendimento 0 ou entrada inválida → 0', () => {
    expect(arrobasDeBoi(480, 0)).toBe(0);
    expect(arrobasDeBoi(NaN, 50)).toBe(0);
    expect(arrobasDeBoi(-10, 50)).toBe(0);
  });
});

describe('valorEmReais', () => {
  it('quantidade × preço, 2 casas', () => {
    expect(valorEmReais(16, 320)).toBe(5120);
    expect(valorEmReais(10.5, 2.5)).toBe(26.25);
  });
  it('entrada inválida/negativa → 0', () => {
    expect(valorEmReais(NaN, 320)).toBe(0);
    expect(valorEmReais(16, -1)).toBe(0);
  });
});

describe('conversão de sacas', () => {
  it('sacas ↔ kg (saca = 60 kg)', () => {
    expect(sacasParaKg(10)).toBe(600);
    expect(kgParaSacas(600)).toBe(10);
    expect(kgParaSacas(630)).toBe(10.5);
  });
  it('entrada inválida → 0', () => {
    expect(sacasParaKg(NaN)).toBe(0);
    expect(kgParaSacas(-5)).toBe(0);
  });
});
