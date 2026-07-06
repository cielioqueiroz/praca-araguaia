import { describe, it, expect } from 'vitest';
import { detectarMovers, montarMensagemAlerta, type LinhaCotacao } from '@/lib/telegram-alertas';

const linhas: LinhaCotacao[] = [
  { tipo: 'boi', valor: 340.1, unidade: 'R$/@', variacao_pct: 4.2, data_referencia: '2026-07-06' },
  { tipo: 'dolar', valor: 5.1, unidade: 'R$', variacao_pct: 0.5, data_referencia: '2026-07-06' },
  { tipo: 'soja', valor: 128.4, unidade: 'R$/sc', variacao_pct: -3.5, data_referencia: '2026-07-06' },
  { tipo: 'milho', valor: 60, unidade: 'R$/sc', variacao_pct: null, data_referencia: '2026-07-06' },
  { tipo: 'euro', valor: 6, unidade: 'R$', variacao_pct: 3, data_referencia: '2026-07-06' },
];

describe('detectarMovers', () => {
  it('mantém só |variação| ≥ 3, na ordem do painel', () => {
    // boi(4.2) soja(-3.5) euro(3) entram; dolar(0.5) e milho(null) saem.
    // ORDEM_PAINEL = boi, soja, milho, dolar, euro, ouro → boi, soja, euro.
    expect(detectarMovers(linhas).map((m) => m.tipo)).toEqual(['boi', 'soja', 'euro']);
  });

  it('inclui o limite exato (3) e respeita limite custom', () => {
    expect(detectarMovers(linhas, 5).map((m) => m.tipo)).toEqual([]);
  });

  it('normaliza os campos do mover', () => {
    const boi = detectarMovers(linhas)[0];
    expect(boi).toEqual({ tipo: 'boi', variacaoPct: 4.2, valor: 340.1, unidade: 'R$/@', dataReferencia: '2026-07-06' });
  });
});

describe('montarMensagemAlerta', () => {
  it('monta o digest com data, títulos, sinais, setas e link', () => {
    const movers = detectarMovers(linhas);
    const msg = montarMensagemAlerta(movers, new Date('2026-07-06T13:00:00Z'));
    expect(msg).toContain('6 de julho');
    expect(msg).toContain('Boi gordo');
    expect(msg).toContain('+4,2%');
    expect(msg).toContain('▲');
    expect(msg).toContain('Soja');
    expect(msg).toContain('▼');
    expect(msg).toContain('agroapp-bay.vercel.app');
  });
});
