import { describe, it, expect, vi } from 'vitest';
import { backfillHistorico } from '@/lib/backfill';
import type { HistoricoRepo, PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = [
  { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
  { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
];

function repoMock(): HistoricoRepo {
  return { salvarHistoricoEmLote: vi.fn().mockResolvedValue(undefined), historicoRecente: vi.fn() };
}

describe('backfillHistorico', () => {
  it('grava todos os pontos e retorna a contagem', async () => {
    const repo = repoMock();
    const r = await backfillHistorico(async () => pontos, repo);
    expect(repo.salvarHistoricoEmLote).toHaveBeenCalledWith(pontos);
    expect(r).toEqual({ pontos: 2 });
  });

  it('não grava se a fonte falhar', async () => {
    const repo = repoMock();
    await expect(
      backfillHistorico(async () => {
        throw new Error('bcb fora');
      }, repo),
    ).rejects.toThrow('bcb fora');
    expect(repo.salvarHistoricoEmLote).not.toHaveBeenCalled();
  });

  it('propaga erro de escrita', async () => {
    const repo = repoMock();
    (repo.salvarHistoricoEmLote as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db fora'));
    await expect(backfillHistorico(async () => pontos, repo)).rejects.toThrow('db fora');
  });
});
