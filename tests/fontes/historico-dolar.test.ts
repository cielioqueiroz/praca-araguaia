import { describe, it, expect, vi } from 'vitest';
import { buscarHistoricoDolarBcb } from '@/lib/fontes/dolar';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
}

describe('buscarHistoricoDolarBcb', () => {
  it('mapeia a série para PontoHistorico[] ordenado', async () => {
    const f = fakeFetch([
      { data: '17/06/2026', valor: '5.10' },
      { data: '18/06/2026', valor: '5.1613' },
    ]);
    const pts = await buscarHistoricoDolarBcb(90, f);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ data: '2026-06-17T03:00:00.000Z', valor: 5.1 });
    expect(pts[1].valor).toBeCloseTo(5.1613);
  });

  it('rejeita lista vazia', async () => {
    const f = fakeFetch([]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita item com valor não positivo', async () => {
    const f = fakeFetch([{ data: '18/06/2026', valor: '0' }]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita data em formato inesperado', async () => {
    const f = fakeFetch([{ data: '2026-06-18', valor: '5.16' }]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch([], false);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });
});
