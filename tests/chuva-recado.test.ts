import { describe, it, expect } from 'vitest';
import { recadoDaSemana } from '@/lib/chuva-recado';

const d = (data: string, chuvaMm: number) => ({ data, chuvaMm });

describe('recadoDaSemana', () => {
  it('semana seca: sem chegada, sem dia molhado, janela é a semana toda', () => {
    const r = recadoDaSemana([d('2026-07-24', 0), d('2026-07-25', 0), d('2026-07-26', 0)]);
    expect(r.semanaSeca).toBe(true);
    expect(r.iChegada).toBe(-1);
    expect(r.iMaisMolhado).toBe(-1);
    expect(r.janela).toEqual({ inicio: 0, fim: 2, tamanho: 3 });
    expect(r.diasSecos).toBe(3);
  });

  it('acha a chegada da chuva (≥ 1 mm), não a garoa', () => {
    // 0,3 mm é garoa e não conta como "a chuva chega".
    const r = recadoDaSemana([d('2026-07-24', 0), d('2026-07-25', 0.3), d('2026-07-26', 4)]);
    expect(r.iChegada).toBe(2);
    expect(r.semanaSeca).toBe(false); // mas há chuva (a garoa conta como molhado)
    expect(r.diasComChuva).toBe(2);
  });

  it('acha o dia mais molhado', () => {
    const r = recadoDaSemana([d('2026-07-24', 2), d('2026-07-25', 11), d('2026-07-26', 5)]);
    expect(r.iMaisMolhado).toBe(1);
  });

  it('a janela seca é a maior sequência de dias secos seguidos', () => {
    // molhado, seco, seco, seco, molhado → janela de 3 (índices 1..3)
    const r = recadoDaSemana([d('a', 3), d('b', 0), d('c', 0), d('d', 0), d('e', 2)]);
    expect(r.janela).toEqual({ inicio: 1, fim: 3, tamanho: 3 });
  });

  it('no empate de janelas, fica com a mais próxima', () => {
    // duas janelas de 2 dias (1..2 e 4..5); a primeira ganha
    const r = recadoDaSemana([d('a', 3), d('b', 0), d('c', 0), d('d', 3), d('e', 0), d('f', 0)]);
    expect(r.janela).toEqual({ inicio: 1, fim: 2, tamanho: 2 });
  });

  it('soma o total em pt-BR com uma casa', () => {
    const r = recadoDaSemana([d('a', 0.05), d('b', 0.05)]);
    expect(r.totalMm).toBe(0.1);
  });

  it('lista vazia não estoura', () => {
    const r = recadoDaSemana([]);
    expect(r.semanaSeca).toBe(true);
    expect(r.janela.tamanho).toBe(0);
  });

  it('semana toda molhada não tem janela seca', () => {
    const r = recadoDaSemana([d('a', 2), d('b', 3), d('c', 4)]);
    expect(r.janela.tamanho).toBe(0);
    expect(r.diasSecos).toBe(0);
  });
});
