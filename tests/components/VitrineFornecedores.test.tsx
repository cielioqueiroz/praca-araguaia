import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';
import type { Fornecedor } from '@/lib/fornecedores';

const fornecedores: Fornecedor[] = [
  { nome: 'Casa Ração', categoria: 'racao-sal', oQueVende: 'ração', municipio: 'Redenção', whatsapp: '5594999998888' },
  { nome: 'Vet Araguaia', categoria: 'veterinario', oQueVende: 'vacinas', municipio: 'Confresa', whatsapp: '5566999997777' },
];

describe('VitrineFornecedores', () => {
  it('lista vazia mostra o estado "em breve" e não mostra chips', () => {
    render(<VitrineFornecedores fornecedores={[]} />);
    expect(screen.getByText(/Vitrine em breve/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ração e sal' })).not.toBeInTheDocument();
  });

  it('com fornecedores, mostra as seções por categoria', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    expect(screen.getByText('Casa Ração')).toBeInTheDocument();
    expect(screen.getByText('Vet Araguaia')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ração e sal' })).toBeInTheDocument();
  });

  it('clicar num chip filtra para aquela categoria', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    fireEvent.click(screen.getByRole('button', { name: 'Veterinário' }));
    expect(screen.getByText('Vet Araguaia')).toBeInTheDocument();
    expect(screen.queryByText('Casa Ração')).not.toBeInTheDocument();
  });

  it('chip de categoria sem fornecedor mostra a mensagem de vazio', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    fireEvent.click(screen.getByRole('button', { name: 'Máquinas e peças' }));
    expect(screen.getByText('Nenhum fornecedor nesta categoria ainda.')).toBeInTheDocument();
  });
});
