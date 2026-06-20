import { describe, it, expect, vi } from 'vitest';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = [
  { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
  { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
];

describe('salvarHistoricoEmLote', () => {
  it('faz upsert com o tipo/fonte informados, ignorando duplicados', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as any;
    await supabaseRepo(client).salvarHistoricoEmLote('euro', 'frankfurter', pontos);
    expect(client.from).toHaveBeenCalledWith('cotacoes_historico');
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'euro', valor: 5.1, fonte: 'frankfurter', data_referencia: pontos[0].data }),
      ]),
      { onConflict: 'tipo,data_referencia', ignoreDuplicates: true },
    );
  });

  it('não chama o banco com lista vazia', async () => {
    const upsert = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as any;
    await supabaseRepo(client).salvarHistoricoEmLote('dolar', 'bcb', []);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('lança se o upsert retornar erro', async () => {
    const client = {
      from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }),
    } as any;
    await expect(supabaseRepo(client).salvarHistoricoEmLote('dolar', 'bcb', pontos)).rejects.toThrow('boom');
  });
});

describe('historicoRecente', () => {
  it('retorna pontos mapeados em ordem', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { valor: '5.10', data_referencia: '2026-06-17T03:00:00.000Z' },
        { valor: '5.1613', data_referencia: '2026-06-18T03:00:00.000Z' },
      ],
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order,
      }),
    } as any;
    const pts = await supabaseRepo(client).historicoRecente('dolar', '2026-03-01T00:00:00.000Z');
    expect(pts).toEqual([
      { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
      { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
    ]);
  });

  it('lança em erro de leitura', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      }),
    } as any;
    await expect(supabaseRepo(client).historicoRecente('dolar', '2026-03-01T00:00:00.000Z')).rejects.toThrow('fail');
  });
});
