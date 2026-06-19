import { describe, it, expect, vi } from 'vitest';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { Cotacao } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.5, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

describe('supabaseRepo.ultimoValor', () => {
  it('retorna o valor do registro mais recente', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { valor: 5.0 }, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar')).toBe(5.0);
  });

  it('retorna null quando não há histórico', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar')).toBeNull();
  });
});

describe('supabaseRepo.salvar', () => {
  it('faz upsert em cotacoes e insert em historico', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === 'cotacoes' ? { upsert } : { insert },
      ),
    } as any;
    const repo = supabaseRepo(client);
    await repo.salvar(cotacao, 10);
    expect(upsert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledOnce();
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
