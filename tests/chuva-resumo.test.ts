import { describe, it, expect } from 'vitest';
import { resumirChuva } from '@/lib/chuva-resumo';
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

const dia = (data: string, chuvaMm: number, probMax: number | null = null) => ({
  data,
  chuvaMm,
  probMax,
  tempMin: 22,
  tempMax: 34,
});

const cidade = (municipio: string, dias: ReturnType<typeof dia>[]): PrevisaoMunicipio => ({
  municipio,
  uf: 'PA',
  dias,
});

describe('resumirChuva', () => {
  it('tira a média dos municípios em cada dia — não a soma', () => {
    // Somar 5 cidades daria um número de mm que não caiu em lugar nenhum.
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 10)]),
      cidade('Confresa', [dia('2026-07-24', 20)]),
    ]);
    expect(r.dias[0].chuvaMm).toBe(15);
    expect(r.totalMm).toBe(15);
  });

  it('a maior probabilidade entre os municípios manda', () => {
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 1, 20)]),
      cidade('Confresa', [dia('2026-07-24', 1, 70)]),
    ]);
    expect(r.dias[0].probMax).toBe(70);
  });

  it('probabilidade ausente em todos vira null, não zero', () => {
    // A Open-Meteo omite a probabilidade nos dias distantes. Zero afirmaria
    // "não vai chover"; null diz "não sabemos", que é a verdade.
    const r = resumirChuva([cidade('Redenção', [dia('2026-07-30', 0, null)])]);
    expect(r.dias[0].probMax).toBeNull();
  });

  it('conta quantos municípios têm chuva de verdade no dia', () => {
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 3)]),
      cidade('Confresa', [dia('2026-07-24', 0)]),
      cidade('Vila Rica', [dia('2026-07-24', 0.05)]), // abaixo do corte: é seco
    ]);
    expect(r.dias[0].municipiosComChuva).toBe(1);
  });

  it('acha o primeiro dia de chuva e o mais molhado', () => {
    const r = resumirChuva([
      cidade('Redenção', [
        dia('2026-07-24', 0),
        dia('2026-07-25', 4),
        dia('2026-07-26', 0),
        dia('2026-07-27', 12),
      ]),
    ]);
    expect(r.primeiroDiaDeChuva?.data).toBe('2026-07-25');
    expect(r.diaMaisMolhado?.data).toBe('2026-07-27');
    expect(r.semanaSeca).toBe(false);
  });

  it('no empate, o dia mais molhado é o MAIS PRÓXIMO', () => {
    // É o dia que o produtor precisa saber para decidir hoje.
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 8), dia('2026-07-25', 8)]),
    ]);
    expect(r.diaMaisMolhado?.data).toBe('2026-07-24');
  });

  it('semana seca não inventa dia de chuva', () => {
    const r = resumirChuva([cidade('Redenção', [dia('2026-07-24', 0), dia('2026-07-25', 0)])]);
    expect(r.semanaSeca).toBe(true);
    expect(r.primeiroDiaDeChuva).toBeNull();
    expect(r.diaMaisMolhado).toBeNull();
    expect(r.totalMm).toBe(0);
  });

  it('o corte de "tem chuva" vale sobre o número JÁ ARREDONDADO', () => {
    // 0,05 mm vira "0,1 mm" na tela. Classificar pelo valor cru diria "dia seco"
    // ao lado de um "0,1 mm" escrito — a tela contradiria a si mesma. O rótulo
    // segue o número que o produtor lê, não o que ficou na memória.
    const r = resumirChuva([cidade('Redenção', [dia('2026-07-24', 0.05)])]);
    expect(r.dias[0].chuvaMm).toBe(0.1);
    expect(r.semanaSeca).toBe(false);

    // Já 0,04 arredonda para 0,0 e é seco de fato.
    const seco = resumirChuva([cidade('Redenção', [dia('2026-07-24', 0.04)])]);
    expect(seco.dias[0].chuvaMm).toBe(0);
    expect(seco.semanaSeca).toBe(true);
  });

  it('sem previsão nenhuma devolve resumo vazio em vez de estourar', () => {
    // A página inteira depende disto: Open-Meteo fora do ar não pode virar 500.
    expect(resumirChuva([])).toEqual({
      dias: [],
      totalMm: 0,
      primeiroDiaDeChuva: null,
      primeiroDiaRelevante: null,
      diaMaisMolhado: null,
      semanaSeca: true,
      maiorDiaMm: 0,
    });
    expect(resumirChuva([cidade('Redenção', [])]).dias).toEqual([]);
  });

  // 0,2 mm é orvalho, não chuva. A página anunciava "A chuva chega sexta-feira"
  // em cima de 0,2 mm, e quem descia para a tabela não achava chuva nenhuma.
  it('orvalho não vira manchete: o dia relevante exige 1 mm', () => {
    const fraca = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 0), dia('2026-07-25', 0.2), dia('2026-07-26', 0.3)]),
    ]);
    expect(fraca.primeiroDiaDeChuva?.data).toBe('2026-07-25'); // tem chuva, sim
    expect(fraca.primeiroDiaRelevante).toBeNull(); // mas não a ponto de anunciar

    const forte = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 0.2), dia('2026-07-25', 6)]),
    ]);
    expect(forte.primeiroDiaRelevante?.data).toBe('2026-07-25');
  });

  it('guarda o maior dia — é a escala com que a faixa da semana é desenhada', () => {
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 2), dia('2026-07-25', 11), dia('2026-07-26', 5)]),
    ]);
    expect(r.maiorDiaMm).toBe(11);
    expect(resumirChuva([cidade('Redenção', [dia('2026-07-24', 0)])]).maiorDiaMm).toBe(0);
  });

  it('séries de tamanhos diferentes são cortadas no menor — nada de média parcial', () => {
    // Se a API mudar e devolver 7 dias para um e 3 para outro, um dia com média
    // de UMA cidade seria apresentado como média da região. Melhor mostrar menos.
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 10), dia('2026-07-25', 10), dia('2026-07-26', 10)]),
      cidade('Confresa', [dia('2026-07-24', 20)]),
    ]);
    expect(r.dias).toHaveLength(1);
    expect(r.dias[0].chuvaMm).toBe(15);
  });

  it('município sem nenhum dia não entra na média dos que têm', () => {
    const r = resumirChuva([
      cidade('Redenção', [dia('2026-07-24', 10)]),
      cidade('Sem dados', []),
    ]);
    expect(r.dias).toHaveLength(1);
    expect(r.dias[0].chuvaMm).toBe(10);
  });
});
