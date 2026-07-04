import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { FormLoginModeracao } from '@/components/FormLoginModeracao';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function preencherEEnviar(senha: string) {
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: senha } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
}

describe('FormLoginModeracao', () => {
  it('senha certa: envia para /api/moderar/login e dá refresh', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FormLoginModeracao />);
    preencherEEnviar('minha-senha');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/moderar/login');
    expect(JSON.parse(String(init.body))).toEqual({ senha: 'minha-senha' });
  });

  it('senha errada: mostra o erro do servidor e não dá refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Senha incorreta.' }), { status: 401 })));
    render(<FormLoginModeracao />);
    preencherEEnviar('errada');
    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sem conexão: mostra mensagem de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    render(<FormLoginModeracao />);
    preencherEEnviar('x');
    expect(await screen.findByText('Sem conexão. Tente de novo.')).toBeInTheDocument();
  });
});
