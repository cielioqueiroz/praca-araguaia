import { describe, it, expect } from 'vitest';
import {
  diaUtil,
  domingoDePascoa,
  feriadoNacional,
  fimDeSemana,
  dataLocal,
} from '@/lib/dia-util';

// Meio-dia UTC = 09:00 no Araguaia: longe das duas bordas do dia, então o teste
// mede o calendário e não um erro de fuso.
const dia = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('dataLocal', () => {
  it('lê a data no fuso do Araguaia, não em UTC', () => {
    expect(dataLocal(dia('2026-07-23'))).toBe('2026-07-23');
    // 01:00 UTC de 24/07 ainda é 22:00 de 23/07 no Araguaia (-03:00).
    expect(dataLocal(new Date('2026-07-24T01:00:00.000Z'))).toBe('2026-07-23');
  });
});

describe('fimDeSemana', () => {
  it('acha sábado e domingo', () => {
    expect(fimDeSemana(dia('2026-07-25'))).toBe(true); // sábado
    expect(fimDeSemana(dia('2026-07-26'))).toBe(true); // domingo
    expect(fimDeSemana(dia('2026-07-24'))).toBe(false); // sexta
    expect(fimDeSemana(dia('2026-07-27'))).toBe(false); // segunda
  });
});

describe('domingoDePascoa', () => {
  // Datas conferidas contra o calendário litúrgico.
  it('calcula a Páscoa de anos conhecidos', () => {
    expect(domingoDePascoa(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(domingoDePascoa(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(domingoDePascoa(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(domingoDePascoa(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
    expect(domingoDePascoa(2030).toISOString().slice(0, 10)).toBe('2030-04-21');
  });
});

describe('feriadoNacional', () => {
  it('acha os fixos', () => {
    expect(feriadoNacional(dia('2026-01-01'))).toBe('Confraternização Universal');
    expect(feriadoNacional(dia('2026-04-21'))).toBe('Tiradentes');
    expect(feriadoNacional(dia('2026-05-01'))).toBe('Dia do Trabalho');
    expect(feriadoNacional(dia('2026-09-07'))).toBe('Independência');
    expect(feriadoNacional(dia('2026-10-12'))).toBe('Nossa Senhora Aparecida');
    expect(feriadoNacional(dia('2026-11-02'))).toBe('Finados');
    expect(feriadoNacional(dia('2026-11-15'))).toBe('Proclamação da República');
    expect(feriadoNacional(dia('2026-12-25'))).toBe('Natal');
  });

  it('acha a Consciência Negra, nacional desde a Lei 14.759/2024', () => {
    expect(feriadoNacional(dia('2026-11-20'))).toBe('Consciência Negra');
  });

  it('acha os móveis de Páscoa de 2026 (Páscoa em 05/04)', () => {
    expect(feriadoNacional(dia('2026-02-16'))).toBe('Carnaval'); // segunda
    expect(feriadoNacional(dia('2026-02-17'))).toBe('Carnaval'); // terça
    expect(feriadoNacional(dia('2026-04-03'))).toBe('Sexta-feira Santa');
    expect(feriadoNacional(dia('2026-06-04'))).toBe('Corpus Christi');
  });

  it('acompanha a Páscoa em outro ano — os móveis não são data fixa', () => {
    // Páscoa de 2027 em 28/03: Carnaval cai em fevereiro, Corpus Christi em maio.
    expect(feriadoNacional(dia('2027-02-08'))).toBe('Carnaval');
    expect(feriadoNacional(dia('2027-03-26'))).toBe('Sexta-feira Santa');
    expect(feriadoNacional(dia('2027-05-27'))).toBe('Corpus Christi');
  });

  it('dia comum não é feriado', () => {
    expect(feriadoNacional(dia('2026-07-23'))).toBeNull();
    expect(feriadoNacional(dia('2026-03-15'))).toBeNull();
  });

  it('não inventa feriado local — só os de alcance nacional entram', () => {
    // Aniversário de Belém (PA) e Consciência Negra estadual antiga: fora.
    expect(feriadoNacional(dia('2026-01-12'))).toBeNull();
    expect(feriadoNacional(dia('2026-08-15'))).toBeNull();
  });
});

describe('diaUtil', () => {
  it('dia de semana comum passa', () => {
    expect(diaUtil(dia('2026-07-23'))).toEqual({ ehDiaUtil: true });
  });

  it('barra o fim de semana, com motivo', () => {
    expect(diaUtil(dia('2026-07-25'))).toEqual({ ehDiaUtil: false, motivo: 'fim de semana' });
  });

  it('barra o feriado nacional, dizendo qual é', () => {
    // O motivo vai para o log e para a resposta: "por que não chegou hoje?"
    // precisa ter resposta escrita.
    expect(diaUtil(dia('2026-12-25'))).toEqual({
      ehDiaUtil: false,
      motivo: 'feriado nacional: Natal',
    });
    expect(diaUtil(dia('2026-06-04'))).toEqual({
      ehDiaUtil: false,
      motivo: 'feriado nacional: Corpus Christi',
    });
  });
});
