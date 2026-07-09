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

  it('esconde o bloco de variação quando variacaoPct é null', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={null} dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} />
    );
    expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument();
  });

  it('mostra variação negativa em vermelho com seta para baixo', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={-2.5} dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} />
    );
    const variacao = screen.getByText(/▼/);
    expect(variacao).toHaveTextContent('2,5%');
    expect(variacao).toHaveClass('text-red-600');
  });

  it('mostra a legenda quando informada', () => {
    render(
      <CardCotacao titulo="Boi gordo" valor={337.5} unidade="R$/@"
        variacaoPct={null} dataReferencia="2026-06-26T03:00:00.000Z" desatualizado={false}
        legenda="média MT/PA/TO/GO · CONAB" />
    );
    expect(screen.getByText('média MT/PA/TO/GO · CONAB')).toBeInTheDocument();
  });

  it('mostra o sparkline quando recebe historico com ≥2 pontos', () => {
    const { container } = render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$" variacaoPct={1.2}
        dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} historico={[5.1, 5.2, 5.43]} />
    );
    expect(container.querySelector('svg polyline')).toBeTruthy();
  });
});
