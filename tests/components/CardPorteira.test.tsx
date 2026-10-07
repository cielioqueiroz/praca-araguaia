import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardPorteira } from '@/app/cotacoes/_components/CardPorteira';

describe('CardPorteira', () => {
  it('mostra desde quando o preço de uma praça está estável', () => {
    render(<CardPorteira
      tipo="boi"
      titulo="Boi gordo"
      unLabel="R$ por arroba"
      rodape="Scot · 06/10"
      precos={[]}
      pracas={[{
        praca: 'Redenção', uf: 'PA', valor: 346, variacaoPct: 0,
        variouEm: '2026-10-05T15:00:00Z',
      }]}
    />);

    expect(screen.getByText('Estável')).toBeInTheDocument();
    expect(screen.getByText('desde 05/10')).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
