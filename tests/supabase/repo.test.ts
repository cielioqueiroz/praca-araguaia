import { describe, it, expect, vi } from 'vitest';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { Cotacao } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.5, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

describe('supabaseRepo.ultimoValor', () => {
  it('retorna o valor do registro mais recente antes da data informada', async () => {
    const lt = vi.fn().mockReturnThis();
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { valor: 5.0 }, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar', cotacao.dataReferencia)).toBe(5.0);
    expect(lt).toHaveBeenCalledWith('data_referencia', cotacao.dataReferencia);
  });

  it('retorna null quando não há histórico anterior à data informada', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar', cotacao.dataReferencia)).toBeNull();
  });
});

describe('supabaseRepo.salvar', () => {
  it('faz upsert em cotacoes e upsert idempotente no historico', async () => {
    const upsertCotacoes = vi.fn().mockResolvedValue({ error: null });
    const upsertHistorico = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === 'cotacoes' ? { upsert: upsertCotacoes } : { upsert: upsertHistorico },
      ),
    } as any;
    const repo = supabaseRepo(client);
    await repo.salvar(cotacao, 10);
    expect(upsertCotacoes).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'dolar' }), { onConflict: 'tipo' });
    expect(upsertHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'dolar', data_referencia: cotacao.dataReferencia }),
      { onConflict: 'tipo,data_referencia', ignoreDuplicates: true },
    );
  });

  it('lança se o upsert retornar erro', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    await expect(repo.salvar(cotacao, 10)).rejects.toThrow('boom');
  });
});
