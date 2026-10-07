import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { PrecoPraca, PrecoUf } from '@/types/cotacao';

const provedorOriginal = process.env.DATABASE_PROVIDER;
afterEach(() => { process.env.DATABASE_PROVIDER = provedorOriginal; });

describe('histórico por lugar no Neon', () => {
  it('grava o fechamento por UF com chave idempotente e fonte correta', async () => {
    process.env.DATABASE_PROVIDER = 'neon';
    const upsertAtual = vi.fn(async () => ({ error: null }));
    const upsertHistorico = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((tabela: string) => tabela === 'cotacoes_lugar_historico'
        ? { upsert: upsertHistorico }
        : { select: () => ({ in: async () => ({ data: [], error: null }) }), upsert: upsertAtual }),
    } as unknown as SupabaseClient;
    const precos: PrecoUf[] = [
      { tipo: 'soja', uf: 'PA', valor: 133.2, unidade: 'R$/sc 60kg', variacaoPct: null, dataReferencia: '2026-10-02T03:00:00Z' },
    ];

    await supabaseRepo(client).salvarPrecosUf(precos);

    expect(upsertAtual).toHaveBeenCalledOnce();
    expect(upsertHistorico).toHaveBeenCalledWith(
      [expect.objectContaining({ tipo: 'soja', recorte: 'uf', uf: 'PA', praca: '', valor: 133.2, fonte: 'conab' })],
      { onConflict: 'tipo,recorte,uf,praca,data_referencia', ignoreDuplicates: true },
    );
  });

  it('grava praça e recusa coleta concluída se a gravação histórica falhar', async () => {
    process.env.DATABASE_PROVIDER = 'neon';
    const upsertAtual = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((tabela: string) => tabela === 'cotacoes_lugar_historico'
        ? { upsert: async () => ({ error: { message: 'histórico indisponível' } }) }
        : {
            select: () => ({ in: async () => ({ data: [], error: null }) }),
            upsert: upsertAtual,
          }),
    } as unknown as SupabaseClient;
    const precos: PrecoPraca[] = [
      { tipo: 'boi', uf: 'PA', praca: 'Redenção', valor: 346, unidade: 'R$/@', variacaoPct: null, dataReferencia: '2026-10-05T03:00:00Z' },
    ];

    await expect(supabaseRepo(client).salvarPrecosPraca(precos)).rejects.toThrow('histórico indisponível');
    expect(upsertAtual).not.toHaveBeenCalled();
  });

  it('lê pontos em ordem sem transformar o preço em agregado regional', async () => {
    const ordem = vi.fn(async () => ({
      data: [{ tipo: 'boi', recorte: 'praca', uf: 'PA', praca: 'Redenção', valor: '346.00', data_referencia: '2026-10-05T03:00:00Z' }],
      error: null,
    }));
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ order: ordem }) }) }) }),
    } as unknown as SupabaseClient;

    expect(await supabaseRepo(client).historicoPorLugar('boi', '2026-09-01T00:00:00Z')).toEqual([
      { tipo: 'boi', recorte: 'praca', uf: 'PA', praca: 'Redenção', data: '2026-10-05T03:00:00Z', valor: 346 },
    ]);
    expect(ordem).toHaveBeenCalledWith('data_referencia', { ascending: true });
  });
});
