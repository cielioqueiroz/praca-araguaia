import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const repositorio = vi.hoisted(() => ({ salvarHistoricoUfEmLote: vi.fn() }));

vi.mock('@/lib/backfill', () => ({ backfillHistorico: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => repositorio) }));
vi.mock('@/lib/neon/repositorio-cotacoes', () => ({ repositorioCotacoesNeon: vi.fn(() => repositorio) }));
vi.mock('@/lib/fontes/conab', () => ({ buscarHistoricoPorUfConab: vi.fn() }));
vi.mock('@/lib/fontes/registry', () => ({
  FONTES_HISTORICO: [
    { tipo: 'dolar', fonte: 'bcb', buscar: vi.fn() },
    { tipo: 'euro', fonte: 'frankfurter', buscar: vi.fn() },
  ],
}));

import { GET } from '@/app/api/backfill/route';
import { backfillHistorico } from '@/lib/backfill';
import { buscarHistoricoPorUfConab } from '@/lib/fontes/conab';

const mock = backfillHistorico as ReturnType<typeof vi.fn>;
const buscarPorUf = buscarHistoricoPorUfConab as ReturnType<typeof vi.fn>;
const provedorOriginal = process.env.DATABASE_PROVIDER;

afterEach(() => { process.env.DATABASE_PROVIDER = provedorOriginal; });

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

describe('GET /api/backfill?lugares=1', () => {
  const pedido = (auth?: string) => new Request('http://localhost/api/backfill?lugares=1', {
    headers: auth ? { authorization: auth } : {},
  });

  it('recusa sem autenticação antes de consultar a fonte', async () => {
    process.env.DATABASE_PROVIDER = 'neon';
    expect((await GET(pedido())).status).toBe(401);
    expect(buscarPorUf).not.toHaveBeenCalled();
  });

  it('grava só pontos verdadeiros dos últimos 90 dias por UF', async () => {
    process.env.DATABASE_PROVIDER = 'neon';
    const hoje = new Date().toISOString();
    buscarPorUf.mockResolvedValue([{ uf: 'PA', pontos: [
      { data: '2025-01-03T03:00:00Z', valor: 100 },
      { data: hoje, valor: 133.2 },
    ] }]);
    repositorio.salvarHistoricoUfEmLote.mockResolvedValue(undefined);

    const resposta = await GET(pedido('Bearer segredo'));

    expect(resposta.status).toBe(200);
    expect(repositorio.salvarHistoricoUfEmLote).toHaveBeenCalledTimes(3);
    expect(repositorio.salvarHistoricoUfEmLote).toHaveBeenCalledWith('soja', 'conab', [
      { uf: 'PA', ponto: { data: hoje, valor: 133.2 }, unidade: 'R$/sc 60kg' },
    ]);
    expect((await resposta.json()).resultados).toEqual([
      { tipo: 'boi', pontos: 1 }, { tipo: 'soja', pontos: 1 }, { tipo: 'milho', pontos: 1 },
    ]);
  });
});
