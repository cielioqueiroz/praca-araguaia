import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Calculadora } from '@/components/Calculadora';

// O ValorContado importa o anime.js por import dinâmico. No teste, o mock assenta
// direto no valor final e chama onUpdate/onComplete — o que interessa aqui é a
// conta, não a animação. Como o import é assíncrono, os valores são verificados
// com waitFor (as quantidades — arrobas, kg — são texto puro e saem na hora).
vi.mock('animejs', () => ({
  animate: (alvo: Record<string, number>, opts: { n: number; onUpdate?: () => void; onComplete?: () => void }) => {
    Object.assign(alvo, { n: opts.n });
    opts.onUpdate?.();
    opts.onComplete?.();
    return { pause: () => {} };
  },
}));

const precos = { boi: 316.5, vaca: 296, novilha: 2971.08, bezerro: 3349, soja: 119.8, milho: 58.46, ouro: 660.36 };

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('Calculadora', () => {
  it('boi na balança: peso × rendimento ÷ 15 × preço', async () => {
    render(<Calculadora precos={precos} />);
    fireEvent.change(screen.getByLabelText('peso vivo (kg)'), { target: { value: '480' } });
    expect(screen.getByTestId('boi-arrobas')).toHaveTextContent('16'); // 480 × 50% ÷ 15
    await waitFor(() => expect(screen.getByTestId('boi-valor')).toHaveTextContent('R$ 5.064,00')); // 16 × 316,50
  });

  it('pré-preenche o preço do boi e troca para o da vaca', () => {
    render(<Calculadora precos={precos} />);
    expect(screen.getByLabelText('preço (R$/@)')).toHaveValue('316,5');
    fireEvent.change(screen.getByLabelText('categoria do gado'), { target: { value: 'vaca' } });
    expect(screen.getByLabelText('preço (R$/@)')).toHaveValue('296');
  });

  // O BUG QUE MOTIVOU A CORREÇÃO (24/07/2026): novilha é reposição, por cabeça — na
  // balança (R$/@) ela dava 13× o valor, porque a arroba multiplicava um preço que
  // já era por cabeça (400 kg → R$ 39.840).
  it('a balança tem só boi e vaca — novilha não entra aqui', () => {
    render(<Calculadora precos={precos} />);
    const balanca = screen.getByLabelText('categoria do gado');
    const opcoes = within(balanca).getAllByRole('option').map((o) => o.textContent);
    expect(opcoes).toEqual(['Boi gordo', 'Vaca gorda']);
  });

  it('novilha é calculada por CABEÇA, ao lado do bezerro', async () => {
    render(<Calculadora precos={precos} />);
    fireEvent.change(screen.getByLabelText('categoria de reposição'), { target: { value: 'novilha' } });
    // Preenche o preço de reposição (R$/cabeça), não um preço de arroba.
    expect(screen.getByLabelText('preço (R$/cabeça)')).toHaveValue('2.971,08');
    fireEvent.change(screen.getByLabelText('cabeças'), { target: { value: '3' } });
    // 3 × 2.971,08 = 8.913,24 — e não arrobas × preço.
    await waitFor(() => expect(screen.getByTestId('reposicao-valor')).toHaveTextContent('R$ 8.913,24'));
  });

  it('reposição abre no bezerro e troca o preço ao mudar para novilha', () => {
    render(<Calculadora precos={precos} />);
    expect(screen.getByLabelText('preço (R$/cabeça)')).toHaveValue('3.349');
    fireEvent.change(screen.getByLabelText('categoria de reposição'), { target: { value: 'novilha' } });
    expect(screen.getByLabelText('preço (R$/cabeça)')).toHaveValue('2.971,08');
  });

  it('grãos: sacas viram kg e valor, e trocar o produto troca o preço', async () => {
    render(<Calculadora precos={precos} />);
    expect(screen.getByLabelText('preço (R$/sc)')).toHaveValue('119,8');
    fireEvent.change(screen.getByLabelText('sacas'), { target: { value: '100' } });
    expect(screen.getByTestId('graos-kg')).toHaveTextContent('6.000'); // 100 × 60
    await waitFor(() => expect(screen.getByTestId('graos-valor')).toHaveTextContent('R$ 11.980,00'));

    fireEvent.change(screen.getByLabelText('produto'), { target: { value: 'milho' } });
    expect(screen.getByLabelText('preço (R$/sc)')).toHaveValue('58,46');
  });

  it('mercado: quantidade × preço, e o Ibovespa não entra (índice não tem lote)', async () => {
    render(<Calculadora precos={precos} />);
    fireEvent.change(screen.getByLabelText('quantidade'), { target: { value: '10' } });
    await waitFor(() => expect(screen.getByTestId('mercado-valor')).toHaveTextContent('R$ 6.603,60')); // 10 g de ouro
    expect(screen.queryByRole('option', { name: /ibovespa/i })).not.toBeInTheDocument();
  });
});
