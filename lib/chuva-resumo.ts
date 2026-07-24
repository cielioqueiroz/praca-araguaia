import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// O que a página de chuva precisa responder ANTES de mostrar tabela nenhuma:
// vai chover, quando, e quanto.
//
// POR QUE ISTO EXISTE: a página listava 5 municípios × 7 dias = 35 linhas, e numa
// semana seca 30 delas eram um traço e uma barra vazia. Tudo com o mesmo peso
// visual, e nenhuma resposta à pergunta que leva o produtor até ali. O resumo é
// derivado dos mesmos dados — não é fonte nova, é leitura.

/** Chuva do dia somada na região: é o que a faixa da semana desenha. */
export type DiaDaRegiao = {
  data: string;
  /** Média dos municípios, em mm. Média e não soma: somar 5 cidades daria um
   *  número que não caiu em lugar nenhum. */
  chuvaMm: number;
  /** Maior probabilidade entre os municípios — a mais alerta manda. */
  probMax: number | null;
  /** Quantos municípios têm chuva de verdade neste dia. */
  municipiosComChuva: number;
};

export type ResumoChuva = {
  dias: DiaDaRegiao[];
  /** Soma dos 7 dias da média regional, em mm. O número do pluviômetro. */
  totalMm: number;
  /** O primeiro dia com chuva de verdade, ou null se a semana é seca. */
  primeiroDiaDeChuva: DiaDaRegiao | null;
  /**
   * O primeiro dia com chuva que MERECE MANCHETE (≥ 1 mm).
   *
   * Existe separado do `primeiroDiaDeChuva` porque 0,2 mm é orvalho, não chuva: a
   * página anunciava "A chuva chega sexta-feira" em cima de 0,2 mm e o produtor
   * chegava na tabela para não achar chuva nenhuma. Título que grita lobo duas
   * vezes não é lido na terceira.
   */
  primeiroDiaRelevante: DiaDaRegiao | null;
  /** O dia mais molhado da semana, ou null se nenhum tem chuva. */
  diaMaisMolhado: DiaDaRegiao | null;
  /** Nenhum município tem chuva em nenhum dia. */
  semanaSeca: boolean;
  /** A maior chuva de um dia — a escala com que a faixa da semana é desenhada. */
  maiorDiaMm: number;
};

/** Abaixo disso o dia é seco — o mesmo corte que o card usa. */
export const CHUVA_MIN_MM = 0.1;

/** Chuva que muda o dia de quem planta. Abaixo disso, não vira manchete. */
export const CHUVA_RELEVANTE_MM = 1;

function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Junta os municípios em uma leitura da REGIÃO, dia a dia.
 *
 * Trabalha pela posição na lista de dias, e não pela data: a Open-Meteo devolve os
 * 7 dias na mesma ordem para todas as coordenadas do mesmo request. Municípios com
 * séries de tamanhos diferentes (nunca visto, mas possível se a API mudar) são
 * cortados no menor tamanho comum, para nenhum dia sair com média parcial.
 */
export function resumirChuva(previsoes: PrevisaoMunicipio[]): ResumoChuva {
  const comDias = previsoes.filter((p) => p.dias.length > 0);
  if (comDias.length === 0) {
    return {
      dias: [],
      totalMm: 0,
      primeiroDiaDeChuva: null,
      primeiroDiaRelevante: null,
      diaMaisMolhado: null,
      semanaSeca: true,
      maiorDiaMm: 0,
    };
  }

  const quantos = Math.min(...comDias.map((p) => p.dias.length));

  const dias: DiaDaRegiao[] = Array.from({ length: quantos }, (_, i) => {
    const doDia = comDias.map((p) => p.dias[i]);
    const soma = doDia.reduce((s, d) => s + d.chuvaMm, 0);
    const probs = doDia.map((d) => d.probMax).filter((p): p is number => p !== null);

    return {
      data: doDia[0].data,
      chuvaMm: arredondar(soma / doDia.length),
      probMax: probs.length > 0 ? Math.max(...probs) : null,
      municipiosComChuva: doDia.filter((d) => d.chuvaMm >= CHUVA_MIN_MM).length,
    };
  });

  const molhados = dias.filter((d) => d.chuvaMm >= CHUVA_MIN_MM);

  return {
    dias,
    totalMm: arredondar(dias.reduce((s, d) => s + d.chuvaMm, 0)),
    primeiroDiaDeChuva: molhados[0] ?? null,
    primeiroDiaRelevante: dias.find((d) => d.chuvaMm >= CHUVA_RELEVANTE_MM) ?? null,
    // reduce e não sort: ordenar mudaria a lista, e o empate tem de ficar com o
    // dia MAIS PRÓXIMO — é ele que o produtor precisa saber.
    diaMaisMolhado: molhados.length > 0 ? molhados.reduce((a, b) => (b.chuvaMm > a.chuvaMm ? b : a)) : null,
    semanaSeca: molhados.length === 0,
    maiorDiaMm: dias.reduce((m, d) => Math.max(m, d.chuvaMm), 0),
  };
}
