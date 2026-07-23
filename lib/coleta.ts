import type { Cotacao, CotacaoSalva, CotacaoRepo } from '@/types/cotacao';

/** O que já estava salvo para um lugar (praça ou estado) antes desta coleta. */
export type LugarSalvo = { valor: number; dataReferencia: string; variacaoPct: number | null };

/**
 * A variação de UM lugar — a praça da Scot, o estado da CONAB.
 *
 * A Scot não publica variação nas páginas de praça (boi/vaca) nem nas de reposição
 * (novilha/bezerro), então boi, vaca, novilha e bezerro chegavam com `variacaoPct`
 * null e o card do Telegram desenhava o gado inteiro sem seta — enquanto soja e
 * milho, que a CONAB manda com variação, mostravam a delas. Lado a lado, o gado
 * parecia congelado. Aqui a variação sai da comparação com o preço que já está no
 * banco para aquele mesmo lugar.
 *
 * Duas armadilhas, ambas vistas nos dados reais:
 *
 * 1. O cron roda todo dia; a Scot publica em dia útil. Recoletar o MESMO fechamento
 *    e compará-lo consigo mesmo daria 0% e apagaria a variação verdadeira daquele
 *    fechamento — por isso a de antes é preservada, não recalculada.
 * 2. Quando a própria fonte publica a variação (o arquivo semanal da CONAB traz),
 *    ela manda. Recalcular por cima trocaria o número de quem apurou pelo nosso.
 */
export function variacaoDoLugar(
  valor: number,
  dataReferencia: string,
  anterior: LugarSalvo | undefined,
  daFonte: number | null,
): number | null {
  if (daFonte !== null) return daFonte;
  if (!anterior) return null;

  // Mesmo fechamento (ou um mais antigo, se a página republicar): nada de novo
  // aconteceu, então o que se sabia continua valendo.
  if (anterior.dataReferencia >= dataReferencia) return anterior.variacaoPct;

  if (anterior.valor <= 0) return null;
  return Math.round(((valor - anterior.valor) / anterior.valor) * 100 * 100) / 100;
}

export async function coletarCotacao(
  fonte: () => Promise<Cotacao>,
  repo: CotacaoRepo,
): Promise<CotacaoSalva> {
  const cotacao = await fonte();
  const anterior = await repo.ultimoValor(cotacao.tipo, cotacao.dataReferencia);

  const variacaoPct =
    anterior === null || anterior === 0
      ? null
      : Math.round(((cotacao.valor - anterior) / anterior) * 100 * 100) / 100;

  await repo.salvar(cotacao, variacaoPct);
  return { ...cotacao, variacaoPct };
}
