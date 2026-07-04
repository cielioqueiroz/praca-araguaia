import { describe, it, expect } from 'vitest';
import { historicoTermometro } from '@/lib/termometro-historico';

// Helper: timestamp ISO em UTC (o agrupamento converte para America/Araguaina, UTC-3).
const r = (criado_em: string, valor: number) => ({ criado_em, valor });

describe('historicoTermometro', () => {
  it('lista vazia devolve vazio', () => {
    expect(historicoTermometro([])).toEqual([]);
  });

  it('vários reportes no mesmo dia viram um ponto com a mediana do dia', () => {
    const pontos = historicoTermometro([
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-01T13:00:00Z', 320),
      r('2026-07-01T14:00:00Z', 310),
    ]);
    expect(pontos).toEqual([{ data: '2026-07-01', valor: 310 }]);
  });

  it('um extremo no dia não puxa o ponto (mediana, não média)', () => {
    const pontos = historicoTermometro([
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-01T13:00:00Z', 310),
      r('2026-07-01T14:00:00Z', 320),
      r('2026-07-01T15:00:00Z', 330),
      r('2026-07-01T16:00:00Z', 900),
    ]);
    expect(pontos).toEqual([{ data: '2026-07-01', valor: 320 }]); // mediana; a média seria 432
  });

  it('vários dias saem ordenados por data crescente', () => {
    const pontos = historicoTermometro([
      r('2026-07-03T12:00:00Z', 340),
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-02T12:00:00Z', 320),
    ]);
    expect(pontos).toEqual([
      { data: '2026-07-01', valor: 300 },
      { data: '2026-07-02', valor: 320 },
      { data: '2026-07-03', valor: 340 },
    ]);
  });

  it('agrupa pelo dia de America/Araguaina, não pelo dia UTC', () => {
    // 2026-07-02T01:00:00Z = 2026-07-01 22:00 em Araguaina (UTC-3) -> cai no dia 01.
    const pontos = historicoTermometro([
      r('2026-07-02T01:00:00Z', 300),
      r('2026-07-02T12:00:00Z', 400),
    ]);
    expect(pontos).toEqual([
      { data: '2026-07-01', valor: 300 },
      { data: '2026-07-02', valor: 400 },
    ]);
  });
});
