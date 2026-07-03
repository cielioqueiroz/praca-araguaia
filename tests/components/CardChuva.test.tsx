import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardChuva } from '@/components/CardChuva';
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

const dia = (data: string, chuvaMm: number, probMax: number | null) => ({
  data, chuvaMm, probMax, tempMin: 19.6, tempMax: 33.4,
});

const previsao: PrevisaoMunicipio = {
  municipio: 'Redenção',
  uf: 'PA',
  dias: [
    dia('2026-07-03', 0, 0),
    dia('2026-07-04', 1.5, 45),
    dia('2026-07-05', 12.3, 90),
    dia('2026-07-06', 0, null),
    dia('2026-07-07', 0, 10),
    dia('2026-07-08', 4.2, 60),
    dia('2026-07-09', 0, 20),
  ],
};

describe('CardChuva', () => {
  it('mostra município, UF e as 7 linhas de dias', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('Redenção · PA')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('destaca chuva forte (>= 10 mm) e não destaca chuva fraca', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('12,3 mm')).toHaveClass('font-semibold');
    expect(screen.getByText('1,5 mm')).not.toHaveClass('font-semibold');
  });

  it('mostra travessão quando a probabilidade é null', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra temperaturas mín–máx arredondadas', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getAllByText('20–33°C')).toHaveLength(7);
  });
});
