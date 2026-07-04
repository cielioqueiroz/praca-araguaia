import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardFornecedor } from '@/components/CardFornecedor';
import { MENSAGEM_PADRAO, type Fornecedor } from '@/lib/fornecedores';

const forn: Fornecedor = {
  nome: 'Agropecuária Boi Bom',
  categoria: 'racao-sal',
  oQueVende: 'Ração, sal mineral e suplementos',
  municipio: 'Redenção',
  whatsapp: '5594999998888',
};

describe('CardFornecedor', () => {
  it('mostra nome, o que vende e município', () => {
    render(<CardFornecedor fornecedor={forn} />);
    expect(screen.getByText('Agropecuária Boi Bom')).toBeInTheDocument();
    expect(screen.getByText('Ração, sal mineral e suplementos')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
  });

  it('o botão aponta para o wa.me com a mensagem padrão, em nova aba e seguro', () => {
    render(<CardFornecedor fornecedor={forn} />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', `https://wa.me/5594999998888?text=${encodeURIComponent(MENSAGEM_PADRAO)}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
