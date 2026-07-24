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
    expect(screen.getByText('Redenção')).toBeInTheDocument();
    expect(screen.getByText('PA')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  // O card foi reescrito em 23/07/2026: saiu dos utilitários do Tailwind e passou
  // a marcar a LINHA com o peso do dia — seco, molhado ou forte. O teste segue a
  // classificação, e não mais o nome de uma classe de estilo.
  it('classifica a linha por peso: seco, molhado e forte (>= 10 mm)', () => {
    render(<CardChuva previsao={previsao} />);
    const linhas = screen.getAllByRole('listitem');

    expect(linhas[0]).toHaveClass('seco'); // 0 mm
    expect(linhas[1]).toHaveClass('molhado'); // 1,5 mm
    expect(linhas[1]).not.toHaveClass('forte');
    expect(linhas[2]).toHaveClass('forte'); // 12,3 mm
  });

  it('o dia seco vira traço, e não "0 mm"', () => {
    // Repetir "0 mm" e "0%" em 5 das 7 linhas era o que deixava o olho sem saber
    // onde pousar. Ausência é traço.
    render(<CardChuva previsao={previsao} />);
    expect(screen.queryByText('0 mm')).toBeNull();
    expect(screen.getByText('12,3 mm')).toBeInTheDocument();
  });

  it('soma o total da semana em pt-BR', () => {
    // 0 + 1,5 + 12,3 + 0 + 0 + 4,2 + 0 = 18 mm. Vírgula, não ponto: o número
    // saía como "18.0 mm" antes de passar pelo toLocaleString.
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('mm em 7 dias')).toBeInTheDocument();
  });

  it('semana sem chuva nenhuma diz isso, em vez de somar zero', () => {
    render(
      <CardChuva
        previsao={{ municipio: 'Confresa', uf: 'MT', dias: [dia('2026-07-03', 0, 0)] }}
      />,
    );
    expect(screen.getByText('sem chuva nos 7 dias')).toBeInTheDocument();
  });

  it('mostra temperaturas mín/máx arredondadas', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getAllByText('20°/33°')).toHaveLength(7);
  });
});
