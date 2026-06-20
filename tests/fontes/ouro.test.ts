import { describe, it, expect, vi } from 'vitest';
import { buscarOuro } from '@/lib/fontes/ouro';

// fetch que responde diferente por URL (gold-api vs frankfurter).
function routedFetch(routes: Record<string, { ok?: boolean; status?: number; body: unknown }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    const r = key ? routes[key] : { ok: false, status: 404, body: {} };
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
  }) as unknown as typeof fetch;
}

describe('buscarOuro', () => {
  it('converte o ouro de USD para R$ (price × USD-BRL)', async () => {
    const f = routedFetch({
      'gold-api': { body: { price: 4000, updatedAt: '2026-06-19T20:00:00Z' } },
      frankfurter: { body: { rates: { BRL: 5.0 } } },
    });
    const c = await buscarOuro(f);
    expect(c.tipo).toBe('ouro');
    expect(c.valor).toBeCloseTo(20000);
    expect(c.unidade).toBe('R$');
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
