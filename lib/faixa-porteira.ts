import { PORTEIRA, TITULOS, UNIDADE_PORTEIRA } from '@/lib/tipos-ui';

/**
 * O resumo da porteira em uma linha — para quem chega e tem dois segundos.
 *
 * A home entregava notícia agregada, que é a única coisa do site que qualquer portal
 * também tem; o preço da praça, que é a promessa, ficava a um clique. Este resumo
 * abre a home com o número.
 *
 * E ele é uma FAIXA, não uma média. O projeto tirou a palavra "média" da interface na
 * fatia 15 porque o spread entre lugares era grande demais para uma média significar
 * alguma coisa (milho PA 66,60 × MT 40,20). A faixa diz a verdade inteira no mesmo
 * espaço: o menor e o maior preço praticado, e em quantos lugares.
 */
export type PrecoDeLugar = { tipo: string; valor: number };

export type FaixaProduto = {
  tipo: string;
  rotulo: string;
  unidade: string;
  min: number;
  max: number;
  /** Quantos lugares entraram na faixa (praças no gado, estados no grão). */
  lugares: number;
};

export function faixasDaPorteira(precos: PrecoDeLugar[]): FaixaProduto[] {
  return PORTEIRA.flatMap((tipo) => {
    const valores = precos.filter((p) => p.tipo === tipo).map((p) => p.valor).filter((v) => Number.isFinite(v));
    if (valores.length === 0) return [];
    return [
      {
        tipo,
        rotulo: TITULOS[tipo] ?? tipo,
        unidade: UNIDADE_PORTEIRA[tipo] ?? '',
        min: Math.min(...valores),
        max: Math.max(...valores),
        lugares: valores.length,
      },
    ];
  });
}
