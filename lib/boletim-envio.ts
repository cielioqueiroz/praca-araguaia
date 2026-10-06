import { dataLocal } from '@/lib/dia-util';
import { ORDEM_PAINEL } from '@/lib/tipos-ui';

export type LinhaAtualizada = { tipo: string; atualizado_em: string };

type ColetaDoBoletim = {
  cotacoes: LinhaAtualizada[];
  pracas: LinhaAtualizada[];
  ufs: LinhaAtualizada[];
};

const TIPOS_PRACA = ['boi', 'vaca'];
const TIPOS_UF = ['novilha', 'bezerro', 'soja', 'milho'];

/** Uma coleta parcial não pode virar um boletim que se apresenta como fechamento novo. */
export function pendenciasDaColeta(dia: string, coleta: ColetaDoBoletim): string[] {
  const pendencias: string[] = [];
  for (const [recorte, tipos, linhas] of [
    ['cotacoes', ORDEM_PAINEL, coleta.cotacoes],
    ['pracas', TIPOS_PRACA, coleta.pracas],
    ['ufs', TIPOS_UF, coleta.ufs],
  ] as const) {
    for (const tipo of tipos) {
      const doTipo = linhas.filter((linha) => linha.tipo === tipo);
      if (
        doTipo.length === 0 ||
        doTipo.some((linha) => {
          const instante = new Date(linha.atualizado_em);
          return !Number.isFinite(instante.getTime()) || dataLocal(instante) !== dia;
        })
      ) {
        pendencias.push(`${recorte}:${tipo}`);
      }
    }
  }
  return pendencias;
}
