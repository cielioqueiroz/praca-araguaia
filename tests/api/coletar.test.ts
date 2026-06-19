import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/coleta', () => ({ coletarCotacao: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/dolar', () => ({ buscarDolar: vi.fn() }));

import { GET } from '@/app/api/coletar/route';
import { coletarCotacao } from '@/lib/coleta';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
});

function req(auth?: string) {
  return new Request('http://localhost/api/coletar', {
    headers: auth ? { authorization: auth } : {},
  });
}

describe('GET /api/coletar', () => {
  it('401 sem o secret correto', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(coletarCotacao).not.toHaveBeenCalled();
  });

  it('200 e resultado quando autorizado e a coleta funciona', async () => {
    (coletarCotacao as ReturnType<typeof vi.fn>).mockResolvedValue({
      tipo: 'dolar', valor: 5.5, unidade: 'R$', fonte: 'awesomeapi',
      dataReferencia: '2026-06-19T12:00:00.000Z', variacaoPct: 1.1,
    });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tipo).toBe('dolar');
  });

  it('502 quando a coleta lança', async () => {
    (coletarCotacao as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fonte fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
  });
});
