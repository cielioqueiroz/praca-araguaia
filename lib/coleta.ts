import type { Cotacao, CotacaoSalva, CotacaoRepo } from '@/types/cotacao';

export async function coletarCotacao(
  fonte: () => Promise<Cotacao>,
  repo: CotacaoRepo,
): Promise<CotacaoSalva> {
  const cotacao = await fonte();
  const anterior = await repo.ultimoValor(cotacao.tipo);

  const variacaoPct =
    anterior === null || anterior === 0
      ? null
      : Math.round(((cotacao.valor - anterior) / anterior) * 100 * 100) / 100;

  await repo.salvar(cotacao, variacaoPct);
  return { ...cotacao, variacaoPct };
}
