import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import type { PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = Array.from({ length: 40 }, (_, i) => ({
  data: new Date(Date.now() - (40 - i) * 86400000).toISOString(),
  valor: 5 + i / 100,
}));

describe('GraficoCotacao', () => {
  it('renderiza os botões de período', () => {
    render(<GraficoCotacao pontos={pontos} titulo="Dólar" unidade="R$" />);
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('renderiza sem quebrar mesmo com poucos pontos', () => {
    render(<GraficoCotacao pontos={pontos.slice(-1)} titulo="Boi gordo" unidade="R$/@" />);
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  // ——— A emenda de fonte (ADR 0002) ———
  //
  // O gráfico do boi mistura CONAB (semanal, até 10/07/2026) e Scot (diária, desde
  // 15/07/2026). Sem marca, o degrau de ~1% entre as duas se lê como mercado.
  describe('troca de fonte', () => {
    // A janela é relativa a hoje: sem congelar o relógio, este teste passa a mentir
    // quando 15/07/2026 sair dos 90 dias.
    const HOJE = new Date('2026-08-18T12:00:00.000Z');
    const serieDoBoi: PontoHistorico[] = [
      { data: '2026-06-26T03:00:00.000Z', valor: 326.96 },
      { data: '2026-07-03T03:00:00.000Z', valor: 321.26 },
      { data: '2026-07-10T03:00:00.000Z', valor: 315.45 },
      { data: '2026-07-15T03:00:00.000Z', valor: 313.14 },
      { data: '2026-08-17T03:00:00.000Z', valor: 338.0 },
    ];

    afterEach(() => vi.useRealTimers());

    function renderBoi() {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(HOJE);
      return render(<GraficoCotacao pontos={serieDoBoi} titulo="Boi gordo" unidade="R$/@" tipoCotacao="boi" />);
    }

    it('em 90 dias, avisa quem publicou cada trecho da linha', () => {
      renderBoi();
      fireEvent.click(screen.getByRole('button', { name: '90d' }));
      expect(screen.getByText(/CONAB até 10\/07 · Scot Consultoria desde 15\/07/)).toBeInTheDocument();
      expect(screen.getByText(/troca de fonte, não do mercado/)).toBeInTheDocument();
    });

    it('em 7 dias não avisa nada — a janela toda é da mesma fonte', () => {
      renderBoi();
      fireEvent.click(screen.getByRole('button', { name: '7d' }));
      expect(screen.queryByText(/troca de fonte/)).not.toBeInTheDocument();
    });

    it('sem tipoCotacao (o gráfico do Termômetro) nunca marca troca', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(HOJE);
      render(<GraficoCotacao pontos={serieDoBoi} titulo="Boi gordo" unidade="R$/@" />);
      fireEvent.click(screen.getByRole('button', { name: '90d' }));
      expect(screen.queryByText(/troca de fonte/)).not.toBeInTheDocument();
    });
  });
});
