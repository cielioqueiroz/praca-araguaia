import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/moderar/decidir/route';
import { createServerClient } from '@/lib/supabase/server';
import { criarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

// update(...).eq('id', ...).eq('status', 'pendente').select('id')
function mockSupabase({ linhas = [{ id: UUID }], error = null }: { linhas?: { id: string }[]; error?: unknown } = {}) {
  const select = vi.fn(async () => ({ data: error ? null : linhas, error }));
  const eqStatus = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqStatus }));
  const update = vi.fn(() => ({ eq: eqId }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ update })),
  });
  return { update, eqId, eqStatus };
}

const req = (body: unknown, cookie?: string) =>
  new Request('http://localhost/api/moderar/decidir', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const cookieValido = () => `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/decidir', () => {
  it('401 sem cookie, com token adulterado ou sem senha configurada', async () => {
    mockSupabase();
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }))).status).toBe(401);
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, `${COOKIE_MODERACAO}=123.abc`))).status).toBe(401);
    vi.stubEnv('MODERACAO_SENHA', '');
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()))).status).toBe(401);
  });

  it('400 para body inválido, sem tocar no banco', async () => {
    const { update } = mockSupabase();
    expect((await POST(req({ id: 'abc', decisao: 'aprovado' }, cookieValido()))).status).toBe(400);
    expect((await POST(req({ id: UUID, decisao: 'sumir' }, cookieValido()))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('200 aprova: update com filtro id + status pendente', async () => {
    const { update, eqId, eqStatus } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: 'aprovado' });
    expect(eqId).toHaveBeenCalledWith('id', UUID);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('200 rejeita com decisao rejeitado', async () => {
    const { update } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'rejeitado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: 'rejeitado' });
  });

  it('404 quando nenhuma linha pendente foi afetada (já moderado)', async () => {
    mockSupabase({ linhas: [] });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: 'Reporte não encontrado ou já moderado.' });
  });

  it('500 quando o banco falha', async () => {
    mockSupabase({ error: { message: 'boom' } });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(500);
  });
});
