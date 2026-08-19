import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/moderar/reporte/route';
import { createServerClient } from '@/lib/supabase/server';
import { criarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';

function mockSupabase({ error = null }: { error?: unknown } = {}) {
  const insert = vi.fn(async () => ({ error }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn(() => ({ insert })) });
  return { insert };
}

const req = (body: unknown, cookie?: string) =>
  new Request('http://localhost/api/moderar/reporte', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie !== undefined ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const cookieValido = () => `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`;
const valido = { produto: 'boi', municipio: 'Redenção', valor: 330 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/reporte', () => {
  it('401 sem cookie, com token adulterado ou sem senha configurada', async () => {
    const { insert } = mockSupabase();
    expect((await POST(req(valido))).status).toBe(401);
    expect((await POST(req(valido, `${COOKIE_MODERACAO}=123.abc`))).status).toBe(401);
    vi.stubEnv('MODERACAO_SENHA', '');
    expect((await POST(req(valido, cookieValido()))).status).toBe(401);
    // Rota de escrita: nada pode ter sido gravado por quem não passou na porta.
    expect(insert).not.toHaveBeenCalled();
  });

  it('200 grava aprovado e com origem "praca" — nunca como reporte de produtor', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req(valido, cookieValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insert.mock.calls[0][0]).toEqual({
      produto: 'boi',
      municipio: 'Redenção',
      valor: 330,
      status: 'aprovado',
      origem: 'praca',
    });
  });

  it('400 para valor fora da faixa plausível — apuração nossa não fura a validação', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, valor: 5 }, cookieValido()));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('400 para município fora das cidades da praça', async () => {
    const { insert } = mockSupabase();
    expect((await POST(req({ ...valido, municipio: 'Goiânia' }, cookieValido()))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('400 para corpo que não é JSON', async () => {
    mockSupabase();
    const res = await POST(
      new Request('http://localhost/api/moderar/reporte', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieValido() },
        body: 'nada disso',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('500 quando o banco recusa a gravação', async () => {
    mockSupabase({ error: { message: 'boom' } });
    const res = await POST(req(valido, cookieValido()));
    expect(res.status).toBe(500);
  });
});
