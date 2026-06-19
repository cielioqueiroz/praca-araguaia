import { describe, it, expect, vi } from 'vitest';
import { coletarCotacao } from '@/lib/coleta';
import type { Cotacao, CotacaoRepo } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.50, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

function repoMock(ultimo: number | null): CotacaoRepo {
  return {
    ultimoValor: vi.fn().mockResolvedValue(ultimo),
    salvar: vi.fn().mockResolvedValue(undefined),
  };
}

describe('coletarCotacao', () => {
  it('calcula a variação percentual contra o último valor', async () => {
    const repo = repoMock(5.00);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeCloseTo(10); // (5.5-5)/5 = 10%
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, expect.closeTo(10, 2));
  });

  it('variação nula na primeira coleta (sem histórico)', async () => {
    const repo = repoMock(null);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeNull();
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, null);
  });

  it('não grava se a fonte falhar', async () => {
    const repo = repoMock(5.00);
    await expect(
      coletarCotacao(async () => { throw new Error('fonte fora'); }, repo)
    ).rejects.toThrow('fonte fora');
    expect(repo.salvar).not.toHaveBeenCalled();
  });

  it('propaga erro de escrita', async () => {
    const repo = repoMock(5.00);
    (repo.salvar as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db fora'));
    await expect(coletarCotacao(async () => cotacao, repo)).rejects.toThrow('db fora');
  });
});
