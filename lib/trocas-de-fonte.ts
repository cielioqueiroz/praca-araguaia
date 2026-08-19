import type { PontoHistorico } from '@/types/cotacao';

/**
 * Onde a série trocou de apurador.
 *
 * A regra (docs/adr/0002-troca-de-fonte-marcada-nao-apagada.md): mesma unidade e
 * mesmo produto com outro apurador → a série continua e a troca é MARCADA. Unidade
 * ou produto diferente → os pontos velhos são apagados por migração (foi o caso do
 * ouro em 0005 e da novilha em 0009), e não entram aqui.
 *
 * A data é a do primeiro ponto JÁ da fonte nova (`data_referencia`), não a do commit
 * que trocou o código: quem lê o gráfico vê datas de pregão, não de deploy.
 */
export type TrocaDeFonte = { tipo: string; data: string; de: string; para: string };

export const TROCAS_DE_FONTE: TrocaDeFonte[] = [
  // Fatia 17 (commit b1956b3, 16/07/2026). A CONAB dava média de estado, semanal,
  // até a referência de 10/07; a Scot dá praça, diária, a partir de 15/07 — o preço
  // que a coleta do dia 16 leu, porque a página publica sempre o dia útil anterior.
  { tipo: 'boi', data: '2026-07-15', de: 'CONAB', para: 'Scot Consultoria' },
  // A vaca veio da Datagro (também por estado) no mesmo movimento.
  { tipo: 'vaca', data: '2026-07-15', de: 'Datagro', para: 'Scot Consultoria' },
];

export type MarcaDeTroca = {
  /** Posição, dentro dos pontos desenhados, do primeiro ponto já da fonte nova. */
  indice: number;
  de: string;
  para: string;
  /** 'CONAB até 10/07 · Scot Consultoria desde 15/07' */
  nota: string;
};

/** '2026-07-15T00:00:00Z' → '15/07' (sem Intl: a data já vem em ISO, e fuso aqui só atrapalha). */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

/**
 * A troca que aparece DENTRO da janela desenhada — ou nada.
 *
 * Nada quando não houve troca no tipo, quando a janela só tem pontos da fonte nova
 * (nada a explicar: é o caso do gráfico de 7 dias) e quando só tem da velha.
 *
 * `pontos` são os já filtrados pelo período, em ordem crescente de data.
 */
export function marcaDeTroca(tipo: string, pontos: PontoHistorico[]): MarcaDeTroca | null {
  const troca = TROCAS_DE_FONTE.find((t) => t.tipo === tipo);
  if (!troca) return null;

  const corte = new Date(troca.data).getTime();
  const indice = pontos.findIndex((p) => new Date(p.data).getTime() >= corte);
  if (indice <= 0) return null;

  const ultimoVelho = pontos[indice - 1];
  const primeiroNovo = pontos[indice];
  return {
    indice,
    de: troca.de,
    para: troca.para,
    nota: `${troca.de} até ${diaMes(ultimoVelho.data)} · ${troca.para} desde ${diaMes(primeiroNovo.data)}`,
  };
}
