import { describe, it, expect } from 'vitest';
import { montarTicker } from '@/lib/ticker';

describe('montarTicker', () => {
  it('usa os valores reais das cotações, na ordem do painel', () => {
    const itens = montarTicker([
      { tipo: 'ouro', valor: 678.23, variacao_pct: -1.08 },
      { tipo: 'boi', valor: 321.26, variacao_pct: -1.74 },
      { tipo: 'bitcoin', valor: 326732, variacao_pct: 0 },
    ]);

    expect(itens.map((i) => i.rotulo)).toEqual(['BOI @', 'OURO/g', 'BTC']);
    expect(itens[0]).toEqual({ rotulo: 'BOI @', valor: '321,26', dir: 'down', pct: '1,74' });
    expect(itens[1].valor).toBe('678,23');
    // Cripto na casa das centenas de milhar: sem centavos, senão a faixa não cabe.
    expect(itens[2]).toEqual({ rotulo: 'BTC', valor: '326.732', dir: 'up', pct: '0' });
  });

  it('mantém 4 casas no câmbio', () => {
    const [usd] = montarTicker([{ tipo: 'dolar', valor: 5.1072, variacao_pct: 0.11 }]);
    expect(usd.valor).toBe('5,1072');
    expect(usd.dir).toBe('up');
  });

  it('ignora tipo desconhecido e trata variação nula como estável', () => {
    const itens = montarTicker([
      { tipo: 'cafe', valor: 10, variacao_pct: 1 },
      { tipo: 'euro', valor: 5.8505, variacao_pct: null },
    ]);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ rotulo: 'EUR', dir: 'up', pct: '0' });
  });
});
