import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Calculadora } from '@/components/Calculadora';

describe('Calculadora', () => {
  it('pré-preenche o preço do boi vindo dos preços', () => {
    render(<Calculadora precos={{ boi: 320, soja: 130, milho: 55 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('320');
  });

  it('pré-preenche preço decimal no formato pt-BR (vírgula)', () => {
    render(<Calculadora precos={{ boi: 321.26 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('321,26');
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

  it('trocar a categoria do gado troca o preço: a vaca não vale o preço do boi', () => {
    render(<Calculadora precos={{ boi: 325.95, vaca: 298.36, novilha: 295.61 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('325,95');
    fireEvent.change(screen.getByLabelText(/categoria do gado/i), { target: { value: 'vaca' } });
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('298,36');
    fireEvent.change(screen.getByLabelText(/categoria do gado/i), { target: { value: 'novilha' } });
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('295,61');
  });

  it('bezerro: a conta é por cabeça, não por arroba', () => {
    render(<Calculadora precos={{ bezerro: 3290.17 }} />);
    expect((screen.getByLabelText(/preço.*cabeça/i) as HTMLInputElement).value).toBe('3.290,17');
    fireEvent.change(screen.getByLabelText(/cabeças/i), { target: { value: '10' } });
    expect(screen.getByTestId('bezerro-valor')).toHaveTextContent('32.901,7');
  });

  it('mercado: ouro em gramas, e trocar o ativo troca preço e unidade', () => {
    render(<Calculadora precos={{ ouro: 672.31, ouro18k: 504.23, bitcoin: 324949 }} />);
    // Abre no ouro 24k.
    fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: '10' } });
    expect(screen.getByTestId('mercado-valor')).toHaveTextContent('6.723,1');

    fireEvent.change(screen.getByLabelText(/^ativo$/i), { target: { value: 'bitcoin' } });
    expect((screen.getByLabelText(/preço do ativo/i) as HTMLInputElement).value).toBe('324.949');
    expect(screen.getByLabelText(/quantidade/i)).toBeInTheDocument();
    // 10 BTC pelo preço do dia.
    expect(screen.getByTestId('mercado-valor')).toHaveTextContent('3.249.490');
  });

  it('o Ibovespa não entra na calculadora: índice não tem lote', () => {
    render(<Calculadora precos={{ ouro: 672.31 }} />);
    expect(screen.queryByRole('option', { name: /ibovespa/i })).not.toBeInTheDocument();
  });
});
