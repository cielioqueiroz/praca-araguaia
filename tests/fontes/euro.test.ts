import { describe, it, expect, vi } from 'vitest';
import { buscarEuro, buscarHistoricoEuroFrankfurter } from '@/lib/fontes/euro';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
}

describe('buscarEuro', () => {
  it('mapeia uma resposta válida para Cotacao', async () => {
    const c = await buscarEuro(fakeFetch({ date: '2026-06-19', rates: { BRL: 5.9173 } }));
    expect(c.tipo).toBe('euro');
    expect(c.valor).toBeCloseTo(5.9173);
    expect(c.unidade).toBe('R$');
    expect(c.fonte).toBe('frankfurter');
    expect(c.dataReferencia).toBe('2026-06-19T03:00:00.000Z'); // 00:00 BRT
  });

  it('rejeita BRL ausente ou não positivo', async () => {
    await expect(buscarEuro(fakeFetch({ date: '2026-06-19', rates: { BRL: 0 } }))).rejects.toThrow();
  });

  it('rejeita resposta sem date', async () => {
    await expect(buscarEuro(fakeFetch({ rates: { BRL: 5.9 } }))).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    await expect(buscarEuro(fakeFetch({}, false))).rejects.toThrow();
  });
});

describe('buscarHistoricoEuroFrankfurter', () => {
  it('mapeia a série para PontoHistorico[] ordenado', async () => {
    const f = fakeFetch({ rates: { '2026-06-18': { BRL: 5.9 }, '2026-06-17': { BRL: 5.88 } } });
    const pts = await buscarHistoricoEuroFrankfurter(90, f);
    expect(pts).toHaveLength(2);
    expect(pts[0].data).toBe('2026-06-17T03:00:00.000Z');
    expect(pts[1].valor).toBeCloseTo(5.9);
  });

  it('rejeita série vazia', async () => {
    await expect(buscarHistoricoEuroFrankfurter(90, fakeFetch({ rates: {} }))).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    await expect(buscarHistoricoEuroFrankfurter(90, fakeFetch({}, false))).rejects.toThrow();
  });
});
