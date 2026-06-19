import type { HistoricoRepo, PontoHistorico } from '@/types/cotacao';

export async function backfillHistorico(
  fonte: () => Promise<PontoHistorico[]>,
  repo: HistoricoRepo,
): Promise<{ pontos: number }> {
  const pontos = await fonte();
  await repo.salvarHistoricoEmLote(pontos);
  return { pontos: pontos.length };
}
