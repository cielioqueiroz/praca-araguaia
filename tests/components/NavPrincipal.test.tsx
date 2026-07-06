import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/chuva' }));

import { NavPrincipal } from '@/components/NavPrincipal';

beforeEach(() => vi.restoreAllMocks());

describe('NavPrincipal', () => {
  it('renderiza os 6 itens do menu', () => {
    render(<NavPrincipal />);
    for (const rotulo of ['Cotações', 'Boletim', 'Chuva', 'Termômetro', 'Fornecedores', 'Calculadora']) {
      expect(screen.getAllByRole('link', { name: rotulo }).length).toBeGreaterThan(0);
    }
  });

  it('marca a rota atual com aria-current=page', () => {
    render(<NavPrincipal />);
    const chuva = screen.getAllByRole('link', { name: 'Chuva' })[0];
    expect(chuva).toHaveAttribute('aria-current', 'page');
    const boletim = screen.getAllByRole('link', { name: 'Boletim' })[0];
    expect(boletim).not.toHaveAttribute('aria-current');
  });

  it('o botão hambúrguer abre e fecha a gaveta', () => {
    render(<NavPrincipal />);
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicar num item da gaveta fecha o menu', () => {
    render(<NavPrincipal />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const gaveta = document.getElementById('menu-mobile') as HTMLElement;
    const linkChuva = gaveta.querySelector('a') as HTMLElement;
    fireEvent.click(linkChuva);
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
