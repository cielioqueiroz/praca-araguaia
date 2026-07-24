// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/chuva-local/route';

const RESPOSTA_OK = {
  current: { temperature_2m: 27.4 },
  daily: {
    time: ['2026-07-23', '2026-07-24'],
    precipitation_sum: [0, 1.2],
    precipitation_probability_max: [10, 60],
    temperature_2m_max: [34, 33],
    temperature_2m_min: [22, 21],
  },
};

function mockOpenMeteo(body: unknown = RESPOSTA_OK, ok = true) {
  const espiao = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }));
  vi.stubGlobal('fetch', espiao);
  return espiao;
}

const req = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/chuva-local', { headers });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/chuva-local', () => {
  it('usa a cidade e as coordenadas do header de geo', async () => {
    const espiao = mockOpenMeteo();
    const res = await GET(
      req({
        'x-vercel-ip-city': 'Reden%C3%A7%C3%A3o',
        'x-vercel-ip-country-region': 'PA',
        'x-vercel-ip-latitude': '-8.02',
        'x-vercel-ip-longitude': '-50.03',
      }),
    );
    const corpo = await res.json();

    expect(corpo.cidade).toBe('Redenção');
    expect(corpo.uf).toBe('PA');
    expect(corpo.tempAtual).toBe(27);
    expect(corpo.dias).toHaveLength(2);
    expect(String(espiao.mock.calls[0][0])).toContain('latitude=-8.02');
  });

  // A fatia 20 corrigiu este mesmo defeito em /api/geo e /api/visita; esta rota
  // tinha ficado de fora, e um header malformado a derrubava com 500.
  it('header de cidade malformado não derruba a rota', async () => {
    mockOpenMeteo();
    const res = await GET(req({ 'x-vercel-ip-city': '%E0%A4%A' }));
    expect(res.status).toBe(200);
    expect((await res.json()).cidade).toBe('%E0%A4%A');
  });

  it('coordenada inválida cai no padrão em vez de virar NaN na URL', async () => {
    // `latitude=NaN` era uma ida à rede garantidamente perdida a cada visita.
    const espiao = mockOpenMeteo();
    await GET(req({ 'x-vercel-ip-latitude': 'abc', 'x-vercel-ip-longitude': '999' }));
    const url = String(espiao.mock.calls[0][0]);

    expect(url).not.toContain('NaN');
    expect(url).toContain('latitude=-15.89');
    expect(url).toContain('longitude=-52.26');
  });

  it('Open-Meteo fora do ar devolve 200 com lista vazia, nunca 500', async () => {
    // A página de chuva depende disso: o card "sua região" some, o resto fica.
    mockOpenMeteo({}, false);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tempAtual: null, dias: [] });
  });

  it('resposta sem daily não estoura', async () => {
    mockOpenMeteo({ current: { temperature_2m: 30 } });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).dias).toEqual([]);
  });

  it('fetch que rejeita vira resposta vazia, não exceção', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora'); }));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).dias).toEqual([]);
  });
});
