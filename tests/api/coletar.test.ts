import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/coleta', () => ({ coletarCotacao: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/registry', () => ({ FONTES: { dolar: vi.fn(), euro: vi.fn() } }));

import { GET } from '@/app/api/coletar/route';
import { coletarCotacao } from '@/lib/coleta';

const mock = coletarCotacao as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
});

function req(auth?: string) {
  return new Request('http://localhost/api/coletar', { headers: auth ? { authorization: auth } : {} });
}

describe('GET /api/coletar', () => {
  it('401 sem o secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(coletarCotacao).not.toHaveBeenCalled();
  });

  it('200 com todas as cotações coletadas', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(2);
    expect(body.erros).toHaveLength(0);
  });

  it('falha de uma fonte não derruba as outras (200 com erro parcial)', async () => {
    mock.mockResolvedValueOnce({ valor: 5.1 }).mockRejectedValueOnce(new Error('fonte fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(1);
    expect(body.erros).toHaveLength(1);
  });

  it('502 quando todas as fontes falham', async () => {
    mock.mockRejectedValue(new Error('tudo fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(0);
    expect(body.erros).toHaveLength(2);
  });
});
