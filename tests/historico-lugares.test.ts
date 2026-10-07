import { describe, expect, it } from 'vitest';
import { lugarInicial, seriesPorLugar } from '@/lib/historico-lugares';
import type { PontoLugar } from '@/types/cotacao';

const DATA = '2026-10-06T03:00:00.000Z';
const pontos: PontoLugar[] = [
  { tipo: 'boi', recorte: 'praca', uf: 'PA', praca: 'Redenção', data: DATA, valor: 346 },
  { tipo: 'boi', recorte: 'praca', uf: 'MT', praca: 'Mato Grosso', data: DATA, valor: 336.5 },
  { tipo: 'boi', recorte: 'uf', uf: 'PA', praca: '', data: DATA, valor: 350 },
];

describe('série por lugar', () => {
  it('boi usa apenas cada praça e nomeia a praça de referência de outro estado', () => {
    const series = seriesPorLugar('boi', [
      { uf: 'MT', praca: 'Mato Grosso' }, { uf: 'PA', praca: 'Redenção' },
    ], [{ uf: 'PA' }], pontos);

    expect(lugarInicial('boi', series)).toBe('praca|PA|Redenção');
    expect(series[0].pontos).toEqual([{ data: DATA, valor: 346 }]);
    expect(series[1].pontos).toEqual([{ data: DATA, valor: 336.5 }]);
    expect(series[1].origem).toContain('Praça Norte, Mato Grosso');
  });

  it('grão usa UF, sem misturar a cotação de praça', () => {
    const serie = seriesPorLugar('soja', [], [{ uf: 'MT' }, { uf: 'PA' }], [
      { tipo: 'soja', recorte: 'uf', uf: 'PA', praca: '', data: DATA, valor: 133.2 },
      { tipo: 'soja', recorte: 'uf', uf: 'MT', praca: '', data: DATA, valor: 142.2 },
    ]);
    expect(lugarInicial('soja', serie)).toBe('uf|PA');
    expect(serie.map((s) => s.pontos[0].valor)).toEqual([133.2, 142.2]);
    expect(serie[0].origem).toContain('CONAB');
  });
});
