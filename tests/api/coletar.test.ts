import { describe, it, expect, vi, beforeEach } from 'vitest';

const salvarPrecosUf = vi.fn();
const salvarPrecosPraca = vi.fn();

vi.mock('@/lib/coleta', () => ({ coletarCotacao: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/registry', () => ({ FONTES: { dolar: vi.fn(), euro: vi.fn() } }));
vi.mock('@/lib/fontes/conab', () => ({ buscarPorUf: vi.fn() }));
vi.mock('@/lib/fontes/pecuaria', () => ({ buscarPorUfPecuaria: vi.fn() }));
vi.mock('@/lib/fontes/scot', () => ({ buscarPorPracaScot: vi.fn() }));

import { GET } from '@/app/api/coletar/route';
import { coletarCotacao } from '@/lib/coleta';
import { buscarPorUf } from '@/lib/fontes/conab';
import { buscarPorUfPecuaria } from '@/lib/fontes/pecuaria';
import { buscarPorPracaScot } from '@/lib/fontes/scot';

vi.mock('@/lib/supabase/repo', () => ({
  supabaseRepo: vi.fn(() => ({ salvarPrecosUf, salvarPrecosPraca })),
}));

const mock = coletarCotacao as ReturnType<typeof vi.fn>;
const mockUf = buscarPorUf as ReturnType<typeof vi.fn>;
const mockUfPec = buscarPorUfPecuaria as ReturnType<typeof vi.fn>;
const mockPraca = buscarPorPracaScot as ReturnType<typeof vi.fn>;

const PRECOS_UF = [
  { tipo: 'boi', uf: 'PA', valor: 298.05, unidade: 'R$/@', variacaoPct: 0.8, dataReferencia: '2026-07-10T03:00:00.000Z' },
  { tipo: 'boi', uf: 'MT', valor: 301.95, unidade: 'R$/@', variacaoPct: -0.3, dataReferencia: '2026-07-10T03:00:00.000Z' },
];

const PRECOS_PRACA = [
  { tipo: 'boi', uf: 'PA', praca: 'Marabá', valor: 314.5, unidade: 'R$/@', variacaoPct: null, dataReferencia: '2026-07-15T03:00:00.000Z', valorPrazo: 318 },
  { tipo: 'boi', uf: 'PA', praca: 'Redenção', valor: 314.5, unidade: 'R$/@', variacaoPct: null, dataReferencia: '2026-07-15T03:00:00.000Z', valorPrazo: 318 },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
  mockUf.mockResolvedValue(PRECOS_UF);
  mockUfPec.mockResolvedValue(PRECOS_UF);
  mockPraca.mockResolvedValue(PRECOS_PRACA);
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

  it('200 com todas as cotações coletadas e os preços por UF e por praça gravados', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(2);
    expect(body.erros).toHaveLength(0);

    // Por estado: grãos e boi (CONAB) + novilha e bezerro (reposição da Scot).
    expect(salvarPrecosUf).toHaveBeenCalledTimes(5);
    expect(body.porUf).toEqual([
      { tipo: 'boi', ufs: 2 },
      { tipo: 'soja', ufs: 2 },
      { tipo: 'milho', ufs: 2 },
      { tipo: 'novilha', ufs: 2 },
      { tipo: 'bezerro', ufs: 2 },
    ]);

    // Por praça: boi e vaca (Scot) — Marabá, Redenção, Paragominas…
    expect(salvarPrecosPraca).toHaveBeenCalledTimes(2);
    expect(salvarPrecosPraca).toHaveBeenCalledWith(PRECOS_PRACA);
    expect(body.porPraca).toEqual([
      { tipo: 'boi', pracas: 2 },
      { tipo: 'vaca', pracas: 2 },
    ]);
  });

  it('falha da CONAB não derruba a reposição (nem as cotações)', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    mockUf.mockRejectedValue(new Error('CONAB fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coletadas).toHaveLength(2);
    expect(body.erros.map((e: { tipo: string }) => e.tipo)).toEqual(['boi_uf', 'soja_uf', 'milho_uf']);
    expect(body.porUf.map((p: { tipo: string }) => p.tipo)).toEqual(['novilha', 'bezerro']);
  });

  it('falha da reposição não derruba a CONAB', async () => {
    mock.mockResolvedValue({ valor: 5.1 });
    mockUfPec.mockRejectedValue(new Error('Notícias Agrícolas fora'));
    const res = await GET(req('Bearer segredo'));
    const body = await res.json();
    expect(body.porUf.map((p: { tipo: string }) => p.tipo)).toEqual(['boi', 'soja', 'milho']);
    expect(body.erros.map((e: { tipo: string }) => e.tipo)).toEqual(['novilha_uf', 'bezerro_uf']);
  });

  it('a Scot fora do ar não derruba a CONAB nem a reposição', async () => {
    // O preço por praça é o destaque do painel, mas a queda dele não pode levar
    // junto o resto da coleta do dia.
    mock.mockResolvedValue({ valor: 5.1 });
    mockPraca.mockRejectedValue(new Error('Scot fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.porPraca).toEqual([]);
    expect(body.porUf).toHaveLength(5);
    expect(body.erros.map((e: { tipo: string }) => e.tipo)).toEqual(['boi_praca', 'vaca_praca']);
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
