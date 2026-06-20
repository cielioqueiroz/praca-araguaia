import type { HistoricoRepo, PontoHistorico } from '@/types/cotacao';

export async function backfillHistorico(
  tipo: string,
  fonte: string,
  buscar: () => Promise<PontoHistorico[]>,
  repo: HistoricoRepo,
): Promise<{ tipo: string; pontos: number }> {
  const pontos = await buscar();
  await repo.salvarHistoricoEmLote(tipo, fonte, pontos);
  return { tipo, pontos: pontos.length };
}
