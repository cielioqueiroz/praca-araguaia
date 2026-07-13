import { describe, it, expect, vi, beforeEach } from 'vitest';

const salvarPrecosUf = vi.fn();

vi.mock('@/lib/coleta', () => ({ coletarCotacao: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/registry', () => ({ FONTES: { dolar: vi.fn(), euro: vi.fn() } }));
vi.mock('@/lib/fontes/conab', () => ({ buscarPorUf: vi.fn() }));

import { GET } from '@/app/api/coletar/route';
import { coletarCotacao } from '@/lib/coleta';
import { buscarPorUf } from '@/lib/fontes/conab';

vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({ salvarPrecosUf })) }));

const mock = coletarCotacao as ReturnType<typeof vi.fn>;
const mockUf = buscarPorUf as ReturnType<typeof vi.fn>;

const PRECOS_UF = [
  { tipo: 'boi', uf: 'PA', valor: 298.05, unidade: 'R$/@', variacaoPct: 0.8, dataReferencia: '2026-07-10T03:00:00.000Z' },
  { tipo: 'boi', uf: 'MT', valor: 301.95, unidade: 'R$/@', variacaoPct: -0.3, dataReferencia: '2026-07-10T03:00:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
  mockUf.mockResolvedValue(PRECOS_UF);
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

  it('200 com todas as cotações coletadas e os preços por UF gravados', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(2);
    expect(body.erros).toHaveLength(0);
    // boi, soja e milho, cada um com as UFs da praça.
    expect(salvarPrecosUf).toHaveBeenCalledTimes(3);
    expect(salvarPrecosUf).toHaveBeenCalledWith(PRECOS_UF);
    expect(body.porUf).toEqual([
      { tipo: 'boi', ufs: 2 },
      { tipo: 'soja', ufs: 2 },
      { tipo: 'milho', ufs: 2 },
    ]);
  });

  it('falha da coleta por UF não derruba as cotações que já entraram', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    mockUf.mockRejectedValue(new Error('CONAB fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(2);
    expect(body.erros.map((e: { tipo: string }) => e.tipo)).toEqual(['boi_uf', 'soja_uf', 'milho_uf']);
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
