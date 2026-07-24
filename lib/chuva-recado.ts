import { CHUVA_MIN_MM, CHUVA_RELEVANTE_MM } from '@/lib/chuva-resumo';

// O RECADO da sua região — a leitura em fatos, para virar frase na tela.
//
// A seção "Onde você está" mostrava só o card dos 7 dias, com o lado direito
// vazio. O recado preenche esse espaço respondendo "e daí, o que eu faço?": quando
// a chuva chega, qual o dia mais molhado e onde está a janela seca — a hora de
// pulverizar ou colher. Deriva dos MESMOS dias do card; não busca nada.
//
// Devolve FATOS (índices e números), não texto: a frase, com nome de dia e data,
// é montada na tela, onde já vive o formatador de data.

export type DiaRecado = { data: string; chuvaMm: number };

export type Recado = {
  totalMm: number;
  diasComChuva: number;
  diasSecos: number;
  /** Índice do primeiro dia com chuva que muda o dia de quem planta (≥ 1 mm). -1 se não há. */
  iChegada: number;
  /** Índice do dia mais molhado. -1 se a semana é seca. */
  iMaisMolhado: number;
  /** A maior sequência de dias secos seguidos — a janela de trabalho. */
  janela: { inicio: number; fim: number; tamanho: number };
  semanaSeca: boolean;
};

function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

export function recadoDaSemana(dias: DiaRecado[]): Recado {
  const vazio: Recado = {
    totalMm: 0,
    diasComChuva: 0,
    diasSecos: 0,
    iChegada: -1,
    iMaisMolhado: -1,
    janela: { inicio: -1, fim: -1, tamanho: 0 },
    semanaSeca: true,
  };
  if (dias.length === 0) return vazio;

  const molhado = (d: DiaRecado) => d.chuvaMm >= CHUVA_MIN_MM;

  let iMaisMolhado = -1;
  dias.forEach((d, i) => {
    if (molhado(d) && (iMaisMolhado === -1 || d.chuvaMm > dias[iMaisMolhado].chuvaMm)) {
      iMaisMolhado = i;
    }
  });

  // A maior sequência de dias secos seguidos. Empate fica com a PRIMEIRA janela —
  // é a mais próxima, a que o produtor pode usar já.
  let melhor = { inicio: -1, fim: -1, tamanho: 0 };
  let ini = -1;
  dias.forEach((d, i) => {
    if (!molhado(d)) {
      if (ini === -1) ini = i;
      const tam = i - ini + 1;
      if (tam > melhor.tamanho) melhor = { inicio: ini, fim: i, tamanho: tam };
    } else {
      ini = -1;
    }
  });

  return {
    totalMm: arredondar(dias.reduce((s, d) => s + d.chuvaMm, 0)),
    diasComChuva: dias.filter(molhado).length,
    diasSecos: dias.filter((d) => !molhado(d)).length,
    iChegada: dias.findIndex((d) => d.chuvaMm >= CHUVA_RELEVANTE_MM),
    iMaisMolhado,
    janela: melhor,
    semanaSeca: iMaisMolhado === -1,
  };
}
