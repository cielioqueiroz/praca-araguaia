import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/moderar/fornecedor/route';
import { createServerClient } from '@/lib/supabase/server';
import { criarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function mockSupabase({ linhas = [{ id: UUID }], error = null }: { linhas?: { id: string }[]; error?: unknown } = {}) {
  const select = vi.fn(async () => ({ data: error ? null : linhas, error }));
  const eqStatus = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqStatus }));
  const update = vi.fn(() => ({ eq: eqId }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn(() => ({ update })) });
  return { update, eqId, eqStatus };
}

const req = (body: unknown, cookie?: string) =>
  new Request('http://localhost/api/moderar/fornecedor', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie !== undefined ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const cookieValido = () => `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/fornecedor', () => {
  it('401 sem cookie / token adulterado / sem senha', async () => {
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

  it('aprovar: update status=aprovado exigindo origem pendente', async () => {
    const { update, eqId, eqStatus } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: 'aprovado' });
    expect(eqId).toHaveBeenCalledWith('id', UUID);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('rejeitar exige origem pendente', async () => {
    const { eqStatus } = mockSupabase();
    await POST(req({ id: UUID, decisao: 'rejeitado' }, cookieValido()));
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('remover exige origem aprovado', async () => {
    const { update, eqStatus } = mockSupabase();
    await POST(req({ id: UUID, decisao: 'removido' }, cookieValido()));
    expect(update).toHaveBeenCalledWith({ status: 'removido' });
    expect(eqStatus).toHaveBeenCalledWith('status', 'aprovado');
  });

  it('404 quando nada foi afetado', async () => {
    mockSupabase({ linhas: [] });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(404);
  });

  it('500 quando o banco falha', async () => {
    mockSupabase({ error: { message: 'boom' } });
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()))).status).toBe(500);
  });
});
