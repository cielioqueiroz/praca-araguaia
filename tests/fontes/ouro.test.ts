import { describe, it, expect, vi } from 'vitest';
import { buscarOuro, buscarOuro18k } from '@/lib/fontes/ouro';

// fetch que responde diferente por URL (gold-api vs frankfurter).
function routedFetch(routes: Record<string, { ok?: boolean; status?: number; body: unknown }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    const r = key ? routes[key] : { ok: false, status: 404, body: {} };
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
  }) as unknown as typeof fetch;
}

describe('buscarOuro', () => {
  it('converte a onça troy (USD) em R$ por grama', async () => {
    const f = routedFetch({
      'gold-api': { body: { price: 4000, updatedAt: '2026-06-19T20:00:00Z' } },
      frankfurter: { body: { rates: { BRL: 5.0 } } },
    });
    const c = await buscarOuro(f);
    expect(c.tipo).toBe('ouro');
    // 4000 USD/oz × 5 = R$ 20.000 a onça troy = R$ 643,02 a grama.
    expect(c.valor).toBeCloseTo(20000 / 31.1034768, 2);
    expect(c.unidade).toBe('R$/g');
    expect(c.fonte).toBe('gold-api');
    expect(c.dataReferencia).toBe('2026-06-19T20:00:00.000Z');
  });

  it('rejeita price não positivo', async () => {
    const f = routedFetch({ 'gold-api': { body: { price: 0 } }, frankfurter: { body: { rates: { BRL: 5 } } } });
    await expect(buscarOuro(f)).rejects.toThrow();
  });

  it('rejeita USD-BRL inválido', async () => {
    const f = routedFetch({ 'gold-api': { body: { price: 4000 } }, frankfurter: { body: { rates: {} } } });
    await expect(buscarOuro(f)).rejects.toThrow();
  });

  it('rejeita quando o gold-api não é ok', async () => {
    const f = routedFetch({ 'gold-api': { ok: false, status: 500, body: {} }, frankfurter: { body: { rates: { BRL: 5 } } } });
    await expect(buscarOuro(f)).rejects.toThrow();
  });
});

describe('buscarOuro18k', () => {
  const f = () =>
    routedFetch({
      'gold-api': { body: { price: 4000, updatedAt: '2026-06-19T20:00:00Z' } },
      frankfurter: { body: { rates: { BRL: 5.0 } } },
    });

  it('é o 24k com 75% de teor (750/1000), não uma segunda cotação', async () => {
    const [k24, k18] = [await buscarOuro(f()), await buscarOuro18k(f())];
    expect(k18.tipo).toBe('ouro18k');
    expect(k18.valor).toBeCloseTo(k24.valor * 0.75, 2);
    expect(k18.unidade).toBe('R$/g');
    expect(k18.fonte).toBe('gold-api');
  });

  it('herda a data de referência do 24k', async () => {
    expect((await buscarOuro18k(f())).dataReferencia).toBe('2026-06-19T20:00:00.000Z');
  });

  it('estoura junto com o 24k quando a fonte falha', async () => {
    const ruim = routedFetch({ 'gold-api': { ok: false, status: 500, body: {} }, frankfurter: { body: { rates: { BRL: 5 } } } });
    await expect(buscarOuro18k(ruim)).rejects.toThrow();
  });
});
