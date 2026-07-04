import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardTermometro } from '@/components/CardTermometro';
import type { ResumoProduto } from '@/lib/termometro';

const resumo: ResumoProduto = {
  produto: 'boi', rotulo: 'Boi gordo', unidade: 'R$/@', media: 325.5, contagem: 3,
  municipios: [
    { municipio: 'Redenção', media: 330, contagem: 2 },
    { municipio: 'Confresa', media: 316.5, contagem: 1 },
  ],
};

describe('CardTermometro', () => {
  it('mostra rótulo, média, contagem e municípios', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('325,5')).toBeInTheDocument();
    expect(screen.getByText('3 reportes · últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
    expect(screen.getByText(/316,5/)).toBeInTheDocument();
  });

  it('singular para 1 reporte', () => {
    render(<CardTermometro resumo={{ ...resumo, contagem: 1, municipios: [] }} />);
    expect(screen.getByText('1 reporte · últimos 7 dias')).toBeInTheDocument();
  });

  it('mostra o contraste com a média CONAB quando informada', () => {
    render(<CardTermometro resumo={resumo} mediaConab={326.96} />);
    expect(screen.getByText(/média CONAB: 326,96/)).toBeInTheDocument();
  });
});
