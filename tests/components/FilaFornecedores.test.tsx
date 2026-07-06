import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilaFornecedores } from '@/components/FilaFornecedores';
import type { FornecedorModeravel } from '@/lib/fornecedores';

beforeEach(() => vi.restoreAllMocks());

const pend: FornecedorModeravel = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  nome: 'Casa Pendente',
  categoriaRotulo: 'Ração e sal',
  oQueVende: 'ração',
  municipio: 'Redenção',
  whatsapp: '5594999998888',
};
const apro: FornecedorModeravel = { ...pend, id: '11111111-1111-1111-1111-111111111111', nome: 'Casa No Ar' };

describe('FilaFornecedores', () => {
  it('mostra pendentes e aprovados', () => {
    render(<FilaFornecedores pendentes={[pend]} aprovados={[apro]} />);
    expect(screen.getByText('Casa Pendente')).toBeInTheDocument();
    expect(screen.getByText('Casa No Ar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover do ar' })).toBeInTheDocument();
  });

  it('Aprovar chama a rota com {id, decisao: aprovado} e some da lista', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }) as never);
    render(<FilaFornecedores pendentes={[pend]} aprovados={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(f).toHaveBeenCalledWith('/api/moderar/fornecedor', expect.objectContaining({ method: 'POST' }));
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toEqual({ id: pend.id, decisao: 'aprovado' });
    expect(await screen.findByText('Nenhum cadastro pendente.')).toBeInTheDocument();
  });

  it('Remover do ar chama com decisao: removido', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }) as never);
    render(<FilaFornecedores pendentes={[]} aprovados={[apro]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover do ar' }));
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toEqual({ id: apro.id, decisao: 'removido' });
  });
});
