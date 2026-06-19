import { describe, it, expect, vi } from 'vitest';
import { buscarDolar, buscarDolarAwesome, buscarDolarBcb } from '@/lib/fontes/dolar';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

// fetch que responde diferente por URL (para testar o fallback).
function routedFetch(routes: Record<string, { ok?: boolean; status?: number; body: unknown }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    const r = key ? routes[key] : { ok: false, status: 404, body: {} };
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
  }) as unknown as typeof fetch;
}

describe('buscarDolarAwesome', () => {
  it('mapeia uma resposta válida para Cotacao', async () => {
    const f = fakeFetch({ USDBRL: { bid: '5.4321', create_date: '2026-06-19 09:00:00' } });
    const c = await buscarDolarAwesome(f);
    expect(c.tipo).toBe('dolar');
    expect(c.valor).toBeCloseTo(5.4321);
    expect(c.unidade).toBe('R$');
    expect(c.fonte).toBe('awesomeapi');
    // create_date vem em BRT (-03:00): 09:00 BRT == 12:00 UTC, independente do TZ do runtime.
    expect(c.dataReferencia).toBe('2026-06-19T12:00:00.000Z');
  });

  it('rejeita valor zero ou negativo', async () => {
    const f = fakeFetch({ USDBRL: { bid: '0', create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolarAwesome(f)).rejects.toThrow();
  });

  it('rejeita resposta sem o campo bid', async () => {
    const f = fakeFetch({ USDBRL: { create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolarAwesome(f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch({}, false);
    await expect(buscarDolarAwesome(f)).rejects.toThrow();
  });
});

describe('buscarDolarBcb', () => {
  it('mapeia uma resposta válida para Cotacao', async () => {
    const f = fakeFetch([{ data: '19/06/2026', valor: '5.1382' }]);
    const c = await buscarDolarBcb(f);
    expect(c.tipo).toBe('dolar');
    expect(c.valor).toBeCloseTo(5.1382);
    expect(c.fonte).toBe('bcb');
    // 00:00 BRT == 03:00 UTC
    expect(c.dataReferencia).toBe('2026-06-19T03:00:00.000Z');
  });

  it('rejeita lista vazia', async () => {
    const f = fakeFetch([]);
    await expect(buscarDolarBcb(f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch([], false);
    await expect(buscarDolarBcb(f)).rejects.toThrow();
  });
});

describe('buscarDolar (fallback)', () => {
  it('usa a AwesomeAPI quando ela responde', async () => {
    const f = routedFetch({
      awesomeapi: { body: { USDBRL: { bid: '5.40', create_date: '2026-06-19 09:00:00' } } },
      'bcb.gov.br': { body: [{ data: '19/06/2026', valor: '5.1382' }] },
    });
    const c = await buscarDolar(f);
    expect(c.fonte).toBe('awesomeapi');
  });

  it('cai para o BCB quando a AwesomeAPI retorna 429', async () => {
    const f = routedFetch({
      awesomeapi: { ok: false, status: 429, body: {} },
      'bcb.gov.br': { body: [{ data: '19/06/2026', valor: '5.1382' }] },
    });
    const c = await buscarDolar(f);
    expect(c.fonte).toBe('bcb');
    expect(c.valor).toBeCloseTo(5.1382);
  });

  it('lança erro agregado quando ambas as fontes falham', async () => {
    const f = routedFetch({
      awesomeapi: { ok: false, status: 429, body: {} },
      'bcb.gov.br': { ok: false, status: 500, body: {} },
    });
    await expect(buscarDolar(f)).rejects.toThrow(/AwesomeAPI.*BCB/s);
  });
});
