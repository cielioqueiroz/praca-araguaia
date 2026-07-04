import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilaModeracao } from '@/components/FilaModeracao';
import type { ReportePendente } from '@/lib/moderacao';

const AGORA = 1_751_600_000_000;

const pendentes: ReportePendente[] = [
  {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    rotulo: 'Boi gordo',
    unidade: 'R$/@',
    valor: 335,
    municipio: 'Vila Rica',
    criadoEm: new Date(AGORA - 2 * 60 * 60_000).toISOString(),
    mediaConab: 326.96,
  },
  {
    id: '8b1f9e22-1234-4cde-9f00-aabbccddeeff',
    rotulo: 'Bezerro',
    unidade: 'R$/cabeça',
    valor: 2800,
    municipio: 'Confresa',
    criadoEm: new Date(AGORA - 30 * 60_000).toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('FilaModeracao', () => {
  it('mostra os cards com valor, município, tempo relativo e referência CONAB', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('335')).toBeInTheDocument();
    expect(screen.getByText('Vila Rica')).toBeInTheDocument();
    expect(screen.getByText('há 2 h')).toBeInTheDocument();
    expect(screen.getByText(/CONAB: 326,96/)).toBeInTheDocument();
    expect(screen.getByText('Bezerro')).toBeInTheDocument();
    expect(screen.queryAllByText(/CONAB:/)).toHaveLength(1); // bezerro não tem referência
  });

  it('fila vazia mostra a mensagem de fila limpa', () => {
    render(<FilaModeracao pendentes={[]} agora={AGORA} />);
    expect(screen.getByText('Fila limpa — nenhum reporte pendente.')).toBeInTheDocument();
  });

  it('aprovar remove o card na hora e envia a decisão', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    expect(screen.queryByText('Boi gordo')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/moderar/decidir');
    expect(JSON.parse(String(init.body))).toEqual({ id: pendentes[0].id, decisao: 'aprovado' });
  });

  it('rejeitar envia decisao rejeitado', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rejeitar' })[1]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      id: pendentes[1].id,
      decisao: 'rejeitado',
    });
  });

  it('falha do servidor devolve o card e mostra o erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Erro ao salvar. Tente de novo.' }), { status: 500 })));
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    expect(await screen.findByText('Erro ao salvar. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByText('Boi gordo')).toBeInTheDocument(); // voltou
  });

  it('decisões concorrentes: falha em A devolve só A; B (sucesso) segue fora da fila', async () => {
    let resolveA!: (r: Response) => void;
    let resolveB!: (r: Response) => void;
    const pA = new Promise<Response>((res) => (resolveA = res));
    const pB = new Promise<Response>((res) => (resolveB = res));
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const { id } = JSON.parse(String(init.body)) as { id: string };
      return id === pendentes[0].id ? pA : pB;
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);

    // Aprova A (Boi gordo) e rejeita B (Bezerro) quase juntos — ambos em voo.
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rejeitar' })[0]); // só resta B na fila
    expect(screen.queryByText('Boi gordo')).not.toBeInTheDocument();
    expect(screen.queryByText('Bezerro')).not.toBeInTheDocument();

    // B resolve 200 primeiro; A falha com 500 depois.
    resolveB(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    resolveA(new Response(JSON.stringify({ erro: 'Erro ao salvar. Tente de novo.' }), { status: 500 }));

    expect(await screen.findByText('Erro ao salvar. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByText('Boi gordo')).toBeInTheDocument(); // A voltou
    expect(screen.queryByText('Bezerro')).not.toBeInTheDocument(); // B moderado com sucesso, sem card fantasma
  });

  it('404 (já moderado) mantém o card removido, sem erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Reporte não encontrado ou já moderado.' }), { status: 404 })));
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    await waitFor(() => expect(screen.queryByText('Boi gordo')).not.toBeInTheDocument());
    expect(screen.queryByText(/não encontrado/)).not.toBeInTheDocument();
  });
});
