import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/backfill', () => ({ backfillHistorico: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/registry', () => ({
  FONTES_HISTORICO: [
    { tipo: 'dolar', fonte: 'bcb', buscar: vi.fn() },
    { tipo: 'euro', fonte: 'frankfurter', buscar: vi.fn() },
  ],
}));

import { GET } from '@/app/api/backfill/route';
import { backfillHistorico } from '@/lib/backfill';

const mock = backfillHistorico as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
});

function req(auth?: string) {
  return new Request('http://localhost/api/backfill', { headers: auth ? { authorization: auth } : {} });
}

describe('GET /api/backfill', () => {
  it('401 sem o secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(backfillHistorico).not.toHaveBeenCalled();
  });

  it('200 com os resultados de cada fonte', async () => {
    mock
      .mockResolvedValueOnce({ tipo: 'dolar', pontos: 61 })
      .mockResolvedValueOnce({ tipo: 'euro', pontos: 65 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resultados).toHaveLength(2);
    expect(body.erros).toHaveLength(0);
  });

  it('falha de uma fonte não derruba a outra', async () => {
    mock
      .mockResolvedValueOnce({ tipo: 'dolar', pontos: 61 })
      .mockRejectedValueOnce(new Error('frankfurter fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resultados).toHaveLength(1);
    expect(body.erros).toHaveLength(1);
  });

  it('502 quando todas as fontes falham', async () => {
    mock.mockRejectedValue(new Error('tudo fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
  });
});
