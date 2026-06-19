import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import type { PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = Array.from({ length: 40 }, (_, i) => ({
  data: new Date(Date.now() - (40 - i) * 86400000).toISOString(),
  valor: 5 + i / 100,
}));

describe('GraficoCotacao', () => {
  it('renderiza os botões de período', () => {
    render(<GraficoCotacao pontos={pontos} />);
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('renderiza sem quebrar mesmo com poucos pontos', () => {
    render(<GraficoCotacao pontos={pontos.slice(-1)} />);
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });
});
