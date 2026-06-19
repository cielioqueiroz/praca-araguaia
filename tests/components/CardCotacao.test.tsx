import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardCotacao } from '@/components/CardCotacao';

describe('CardCotacao', () => {
  it('mostra título e valor formatado', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={1.2} dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} />
    );
    expect(screen.getByText('Dólar')).toBeInTheDocument();
    expect(screen.getByText(/5,43/)).toBeInTheDocument();
  });

  it('marca como desatualizado quando a flag está ligada', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={null} dataReferencia="2026-06-10T12:00:00.000Z" desatualizado={true} />
    );
    expect(screen.getByText(/desatualizado/i)).toBeInTheDocument();
  });
});
