import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardTermometro } from '@/components/CardTermometro';
import type { ResumoProduto } from '@/lib/termometro';

const resumo: ResumoProduto = {
  produto: 'boi', rotulo: 'Boi gordo', unidade: 'R$/@', mediana: 325.5,
  faixa: { min: 300, max: 360 }, contagem: 3,
  municipios: [
    { municipio: 'Redenção', mediana: 330, contagem: 2 },
    { municipio: 'Confresa', mediana: 316.5, contagem: 1 },
  ],
};

describe('CardTermometro', () => {
  it('mostra rótulo, valor típico (mediana), etiqueta, contagem e municípios', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('325,5')).toBeInTheDocument();
    expect(screen.getByText('valor típico')).toBeInTheDocument();
    expect(screen.getByText('3 reportes · últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
    expect(screen.getByText(/316,5/)).toBeInTheDocument();
  });

  it('mostra a faixa quando há 2+ reportes com dispersão', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText(/faixa: R\$ 300–360/)).toBeInTheDocument();
  });

  it('não mostra a faixa com 1 reporte', () => {
    render(<CardTermometro resumo={{ ...resumo, contagem: 1, faixa: { min: 325.5, max: 325.5 }, municipios: [] }} />);
    expect(screen.getByText('1 reporte · últimos 7 dias')).toBeInTheDocument();
    expect(screen.queryByText(/faixa:/)).not.toBeInTheDocument();
  });

  it('não mostra a faixa quando min == max (todos iguais)', () => {
    render(<CardTermometro resumo={{ ...resumo, faixa: { min: 320, max: 320 } }} />);
    expect(screen.queryByText(/faixa:/)).not.toBeInTheDocument();
  });

  it('mostra o contraste com a média CONAB quando informada', () => {
    render(<CardTermometro resumo={resumo} mediaConab={326.96} />);
    expect(screen.getByText(/média CONAB: 326,96/)).toBeInTheDocument();
  });
});
