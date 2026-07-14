import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buscarIbovespa, buscarHistoricoIbovespa, resetCacheIbovespa } from '@/lib/fontes/ibovespa';

const resposta = (corpo: unknown, ok = true, status = 200) =>
  vi.fn(async () => ({ ok, status, json: async () => corpo })) as unknown as typeof fetch;

const CORPO = {
  chart: {
    result: [
      {
        meta: { regularMarketPrice: 176617.33, regularMarketTime: 1784034000 },
        timestamp: [1783688400, 1783947600, 1784034000],
        indicators: { quote: [{ close: [177866, null, 176617.328125] }] },
      },
    ],
  },
};

beforeEach(() => resetCacheIbovespa());

describe('buscarIbovespa', () => {
  it('lê o índice em PONTOS, não em reais', async () => {
    const c = await buscarIbovespa(resposta(CORPO));
    expect(c.tipo).toBe('ibovespa');
    expect(c.valor).toBe(176617.33);
    expect(c.unidade).toBe('pts'); // se virar 'R$', o card passa a mentir
    expect(c.fonte).toBe('b3/yahoo');
    expect(c.dataReferencia).toBe(new Date(1784034000 * 1000).toISOString());
  });

  it('estoura quando o Yahoo não responde ok', async () => {
    await expect(buscarIbovespa(resposta({}, false, 503))).rejects.toThrow('503');
  });

  it('estoura quando vem sem preço, em vez de gravar zero', async () => {
    const vazio = { chart: { result: [{ meta: {} }] } };
    await expect(buscarIbovespa(resposta(vazio))).rejects.toThrow(/inválida/);
  });
});

describe('buscarHistoricoIbovespa', () => {
  it('devolve a série diária e descarta o pregão sem fechamento (null)', async () => {
    const pontos = await buscarHistoricoIbovespa(resposta(CORPO));
    expect(pontos).toHaveLength(2); // o null do meio sumiu — não virou zero
    expect(pontos[0].valor).toBe(177866);
    expect(pontos[1].valor).toBe(176617.33);
  });

  it('usa a mesma resposta da coleta — uma ida à rede, não duas', async () => {
    const f = resposta(CORPO);
    await buscarIbovespa(f);
    await buscarHistoricoIbovespa(f);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
