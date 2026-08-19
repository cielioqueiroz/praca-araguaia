import { describe, it, expect } from 'vitest';
import { marcaDeTroca, TROCAS_DE_FONTE } from '@/lib/trocas-de-fonte';
import type { PontoHistorico } from '@/types/cotacao';

function p(data: string, valor = 300): PontoHistorico {
  return { data: `${data}T03:00:00.000Z`, valor };
}

// A série real do boi: CONAB semanal (sextas) até 10/07 e Scot diária desde 15/07.
const serieDoBoi = [
  p('2026-06-26', 326.96),
  p('2026-07-03', 321.26),
  p('2026-07-10', 315.45),
  p('2026-07-15', 313.14),
  p('2026-07-16', 314.13),
  p('2026-07-17', 315.25),
];

describe('marcaDeTroca', () => {
  it('marca o primeiro ponto da fonte nova e diz quem publicou cada trecho', () => {
    const marca = marcaDeTroca('boi', serieDoBoi);
    expect(marca).toEqual({
      indice: 3,
      de: 'CONAB',
      para: 'Scot Consultoria',
      nota: 'CONAB até 10/07 · Scot Consultoria desde 15/07',
    });
  });

  it('não marca nada quando a janela só tem a fonte nova', () => {
    // É o gráfico de 7 dias de hoje: todo mundo é Scot, não há degrau para explicar.
    expect(marcaDeTroca('boi', serieDoBoi.slice(3))).toBeNull();
  });

  it('não marca nada quando a janela para antes da troca', () => {
    expect(marcaDeTroca('boi', serieDoBoi.slice(0, 3))).toBeNull();
  });

  it('não marca nada em tipo que nunca trocou de fonte', () => {
    expect(marcaDeTroca('dolar', serieDoBoi)).toBeNull();
    expect(marcaDeTroca('soja', serieDoBoi)).toBeNull();
  });

  it('lista vazia não quebra', () => {
    expect(marcaDeTroca('boi', [])).toBeNull();
  });

  it('a vaca também tem a emenda registrada', () => {
    const marca = marcaDeTroca('vaca', [p('2026-07-10'), p('2026-07-15'), p('2026-07-16')]);
    expect(marca?.nota).toBe('Datagro até 10/07 · Scot Consultoria desde 15/07');
  });

  it('só registra troca de MESMA unidade — novilha e ouro foram apagados por migração', () => {
    // A novilha virou outro produto (arroba → cabeça) e o ouro mudou de unidade
    // (onça → grama): lá a série antiga saiu do banco, não vira marca no gráfico.
    const tipos = TROCAS_DE_FONTE.map((t) => t.tipo);
    expect(tipos).not.toContain('novilha');
    expect(tipos).not.toContain('ouro');
  });
});
