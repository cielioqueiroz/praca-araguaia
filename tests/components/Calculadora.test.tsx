import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Calculadora } from '@/components/Calculadora';

describe('Calculadora', () => {
  it('pré-preenche o preço do boi vindo dos preços', () => {
    render(<Calculadora precos={{ boi: 320, soja: 130, milho: 55 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('320');
  });

  it('calcula arrobas e valor do lote de boi', () => {
    render(<Calculadora precos={{ boi: 320 }} />);
    fireEvent.change(screen.getByLabelText(/peso vivo/i), { target: { value: '480' } });
    fireEvent.change(screen.getByLabelText(/rendimento/i), { target: { value: '50' } });
    expect(screen.getByTestId('boi-arrobas')).toHaveTextContent('16');
    expect(screen.getByTestId('boi-valor')).toHaveTextContent('5.120');
  });

  it('grãos: sacas mostram o equivalente em kg e o valor da colheita', () => {
    render(<Calculadora precos={{ soja: 130 }} />);
    fireEvent.change(screen.getByLabelText(/sacas/i), { target: { value: '10' } });
    expect(screen.getByTestId('graos-kg')).toHaveTextContent('600');
    expect(screen.getByTestId('graos-valor')).toHaveTextContent('1.300');
  });

  it('trocar o produto dos grãos troca o preço padrão', () => {
    render(<Calculadora precos={{ soja: 130, milho: 55 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/sc/i) as HTMLInputElement).value).toBe('130');
    fireEvent.change(screen.getByLabelText(/produto/i), { target: { value: 'milho' } });
    expect((screen.getByLabelText(/preço.*R\$\/sc/i) as HTMLInputElement).value).toBe('55');
  });
});
