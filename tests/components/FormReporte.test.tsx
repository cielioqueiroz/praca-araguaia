import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormReporte } from '@/components/FormReporte';

beforeEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status }) as never,
  );
}

describe('FormReporte', () => {
  it('renderiza os campos e o botão', () => {
    render(<FormReporte />);
    expect(screen.getByLabelText('Produto')).toBeInTheDocument();
    expect(screen.getByLabelText('Município')).toBeInTheDocument();
    expect(screen.getByLabelText(/Preço/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar preço' })).toBeInTheDocument();
  });

  it('envia e mostra a confirmação', async () => {
    const f = mockFetch(200, { recebido: true });
    render(<FormReporte />);
    fireEvent.change(screen.getByLabelText(/Preço/), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar preço' }));
    expect(await screen.findByText(/Recebido!/)).toBeInTheDocument();
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({ produto: 'boi', municipio: 'Redenção', valor: 320, contato: '' });
  });

  it('mostra o erro da API (faixa ou limite)', async () => {
    mockFetch(429, { erro: 'Limite diário atingido — tente amanhã.' });
    render(<FormReporte />);
    fireEvent.change(screen.getByLabelText(/Preço/), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar preço' }));
    expect(await screen.findByText(/Limite diário/)).toBeInTheDocument();
  });
});
