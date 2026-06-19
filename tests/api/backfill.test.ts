import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/backfill', () => ({ backfillHistorico: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/dolar', () => ({ buscarHistoricoDolarBcb: vi.fn() }));

import { GET } from '@/app/api/backfill/route';
import { backfillHistorico } from '@/lib/backfill';

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

  it('200 com a contagem quando autorizado', async () => {
    (backfillHistorico as ReturnType<typeof vi.fn>).mockResolvedValue({ pontos: 90 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pontos: 90 });
  });

  it('502 quando o backfill lança', async () => {
    (backfillHistorico as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bcb fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
  });
});
