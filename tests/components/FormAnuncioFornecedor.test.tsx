import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormAnuncioFornecedor } from '@/components/FormAnuncioFornecedor';

beforeEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }) as never);
}

function preencher() {
  fireEvent.change(screen.getByLabelText('Nome do fornecedor'), { target: { value: 'Casa Agro' } });
  fireEvent.change(screen.getByLabelText('O que vende'), { target: { value: 'ração e sal' } });
  fireEvent.change(screen.getByLabelText('Município'), { target: { value: 'Redenção' } });
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: '(94) 99999-8888' } });
}

describe('FormAnuncioFornecedor', () => {
  it('renderiza os campos e o botão', () => {
    render(<FormAnuncioFornecedor />);
    expect(screen.getByLabelText('Nome do fornecedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('O que vende')).toBeInTheDocument();
    expect(screen.getByLabelText('Município')).toBeInTheDocument();
    expect(screen.getByLabelText(/WhatsApp/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar cadastro' })).toBeInTheDocument();
  });

  it('envia os campos certos e mostra a confirmação', async () => {
    const f = mockFetch(200, { recebido: true });
    render(<FormAnuncioFornecedor />);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));
    expect(await screen.findByText(/Recebido!/)).toBeInTheDocument();
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({
      nome: 'Casa Agro',
      categoria: 'racao-sal',
      oQueVende: 'ração e sal',
      municipio: 'Redenção',
      whatsapp: '(94) 99999-8888',
      contato: '',
    });
  });

  it('mostra o erro da API', async () => {
    mockFetch(429, { erro: 'Limite diário atingido — tente amanhã.' });
    render(<FormAnuncioFornecedor />);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));
    expect(await screen.findByText(/Limite diário/)).toBeInTheDocument();
  });
});
