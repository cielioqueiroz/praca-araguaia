import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buscarBitcoin,
  buscarEthereum,
  buscarHistoricoCripto,
  resetCacheCripto,
} from '@/lib/fontes/cripto';

const PRECO_OK = { bitcoin: { brl: 617482.1 }, ethereum: { brl: 8951.01 } };

const fetchDe = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => resetCacheCripto());

describe('cripto', () => {
  it('lê bitcoin e ethereum em reais', async () => {
    const f = fetchDe(PRECO_OK);

    const btc = await buscarBitcoin(f);
    expect(btc.tipo).toBe('bitcoin');
    expect(btc.valor).toBe(617482.1);
    expect(btc.unidade).toBe('R$');
    expect(btc.fonte).toBe('coingecko');

    const eth = await buscarEthereum(f);
    expect(eth.tipo).toBe('ethereum');
    expect(eth.valor).toBe(8951.01);
  });

  it('baixa a cotação uma vez só para as duas moedas', async () => {
    const f = fetchDe(PRECO_OK);
    await buscarBitcoin(f);
    await buscarEthereum(f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('rejeita resposta sem a moeda', async () => {
    await expect(buscarBitcoin(fetchDe({ ethereum: { brl: 8951.01 } }))).rejects.toThrow();
  });

  it('rejeita preço não positivo', async () => {
    await expect(
      buscarBitcoin(fetchDe({ bitcoin: { brl: 0 }, ethereum: { brl: 8951.01 } })),
    ).rejects.toThrow();
  });

  it('rejeita HTTP não-ok', async () => {
    await expect(buscarBitcoin(fetchDe({}, false))).rejects.toThrow();
  });

  it('converte o market_chart em pontos históricos', async () => {
    const f = fetchDe({
      prices: [
        [1751328000000, 600000],
        [1751414400000, 610000.456],
      ],
    });
    const pontos = await buscarHistoricoCripto('bitcoin', f);
    expect(pontos).toHaveLength(2);
    expect(pontos[0]).toEqual({ data: new Date(1751328000000).toISOString(), valor: 600000 });
    expect(pontos[1].valor).toBe(610000.46);
  });

  it('rejeita histórico vazio', async () => {
    await expect(buscarHistoricoCripto('ethereum', fetchDe({ prices: [] }))).rejects.toThrow();
  });
});
