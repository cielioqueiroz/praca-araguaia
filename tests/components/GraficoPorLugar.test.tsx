import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GraficoPorLugar } from '@/app/cotacao/[tipo]/_components/GraficoPorLugar';

vi.mock('@/components/GraficoCotacao', () => ({
  GraficoCotacao: ({ pontos }: { pontos: Array<{ valor: number }> }) =>
    <div data-testid="grafico">{pontos.map((p) => p.valor).join(', ')}</div>,
}));

describe('GraficoPorLugar', () => {
  it('troca a série sem misturar valores de duas praças', () => {
    render(<GraficoPorLugar tipo="boi" titulo="Boi gordo" unidade="R$/@" series={[
      { chave: 'praca|PA|Redenção', nome: 'Redenção · PA', origem: 'Scot', pontos: [{ data: '2026-10-05T03:00:00Z', valor: 346 }] },
      { chave: 'praca|PA|Marabá', nome: 'Marabá · PA', origem: 'Scot', pontos: [{ data: '2026-10-05T03:00:00Z', valor: 351 }] },
    ]} />);

    expect(screen.getByTestId('grafico')).toHaveTextContent('346');
    expect(screen.getByText(/histórico deste lugar começou/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Praça do gráfico'), { target: { value: 'praca|PA|Marabá' } });
    expect(screen.getByTestId('grafico')).toHaveTextContent('351');
    expect(screen.getByTestId('grafico')).not.toHaveTextContent('346');
  });
});
