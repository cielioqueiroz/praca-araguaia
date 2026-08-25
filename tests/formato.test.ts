import { describe, it, expect } from 'vitest';
import { numero, numeroEnxuto, dataExtensa, dataLonga, horaLocal } from '@/lib/formato';

describe('numero', () => {
  it('fecha o centavo do preço', () => {
    expect(numero(316.5, 2)).toBe('316,50');
    expect(numero(316, 2)).toBe('316,00');
  });

  it('separa milhar com ponto, decimal com vírgula', () => {
    expect(numero(2788, 2)).toBe('2.788,00');
    expect(numero(145678.9, 0)).toBe('145.679');
  });

  it('honra a quantidade de casas pedida', () => {
    expect(numero(5.4321, 4)).toBe('5,4321');
    expect(numero(5.4321, 0)).toBe('5');
  });

  it('reaproveita o formatador entre chamadas com a mesma forma', () => {
    // Não é teste de identidade de objeto (o cache é interno): é a garantia de que
    // chamar duas vezes não muda o resultado — que é o risco de um cache errado.
    expect(numero(1234.5, 2)).toBe(numero(1234.5, 2));
    expect(numero(1234.5, 2)).toBe('1.234,50');
  });
});

describe('numeroEnxuto', () => {
  it('não inventa centavo em número redondo', () => {
    expect(numeroEnxuto(18)).toBe('18');
  });

  it('mantém o decimal quando existe', () => {
    expect(numeroEnxuto(18.5)).toBe('18,5');
    expect(numeroEnxuto(18.25)).toBe('18,25');
  });

  it('não confunde com a forma do preço', () => {
    expect(numeroEnxuto(316)).not.toBe(numero(316, 2));
  });
});

describe('datas no fuso do Araguaia', () => {
  // 25/08/2026 às 23:30 UTC = 20:30 do MESMO dia no Araguaia (-03:00).
  // Se o fuso vazasse, esta data viraria 26/08 no servidor.
  const noiteUtc = new Date('2026-08-25T23:30:00Z');

  it('não adianta o dia quando o relógio do servidor é UTC', () => {
    expect(dataExtensa(noiteUtc)).toContain('25 de agosto de 2026');
    expect(dataLonga(noiteUtc)).toBe('25 de agosto de 2026');
  });

  it('traz o dia da semana só na forma extensa', () => {
    expect(dataExtensa(noiteUtc)).toContain('terça-feira');
    expect(dataLonga(noiteUtc)).not.toContain('terça');
  });

  it('lê a hora no relógio do Araguaia, não no do servidor', () => {
    expect(horaLocal(noiteUtc)).toBe('20:30');
    expect(horaLocal(new Date('2026-08-25T20:30:00Z'))).toBe('17:30');
  });
});
