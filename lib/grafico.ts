import type { PontoHistorico } from '@/types/cotacao';

/** Mantém apenas os pontos dentro dos últimos `dias` a partir de `agora`. */
export function filtrarPorPeriodo(
  pontos: PontoHistorico[],
  dias: number,
  agora: Date = new Date(),
): PontoHistorico[] {
  const limite = agora.getTime() - dias * 24 * 60 * 60 * 1000;
  return pontos.filter((p) => new Date(p.data).getTime() >= limite);
}
