import { describe, it, expect, vi } from 'vitest';
import { buscarDolar } from '@/lib/fontes/dolar';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('buscarDolar', () => {
  it('mapeia uma resposta válida para Cotacao', async () => {
    const f = fakeFetch({ USDBRL: { bid: '5.4321', create_date: '2026-06-19 09:00:00' } });
    const c = await buscarDolar(f);
    expect(c.tipo).toBe('dolar');
    expect(c.valor).toBeCloseTo(5.4321);
    expect(c.unidade).toBe('R$');
    expect(c.fonte).toBe('awesomeapi');
    expect(typeof c.dataReferencia).toBe('string');
  });

  it('rejeita valor zero ou negativo', async () => {
    const f = fakeFetch({ USDBRL: { bid: '0', create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolar(f)).rejects.toThrow();
  });

  it('rejeita resposta sem o campo bid', async () => {
    const f = fakeFetch({ USDBRL: { create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolar(f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch({}, false);
    await expect(buscarDolar(f)).rejects.toThrow();
  });
});
