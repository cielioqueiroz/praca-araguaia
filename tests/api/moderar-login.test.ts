import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A rota conta tentativas recentes no banco. O mock controla a contagem: por padrão
// zero (caminho feliz), e um teste sobe para o limite. Sem env de Supabase, o
// createServerClient real lançaria — o mock também isola disso.
const contagem = { valor: 0 };
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: contagem.valor, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

import { POST } from '@/app/api/moderar/login/route';
import { verificarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const req = (body: unknown) =>
  new Request('http://localhost/api/moderar/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  contagem.valor = 0;
  vi.stubEnv('MODERACAO_SENHA', 'senha-de-teste');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/login', () => {
  it('500 quando MODERACAO_SENHA não está configurada', async () => {
    vi.stubEnv('MODERACAO_SENHA', '');
    const res = await POST(req({ senha: 'qualquer' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ erro: 'Moderação não configurada.' });
  });

  it('401 para senha errada, sem Set-Cookie', async () => {
    const res = await POST(req({ senha: 'errada' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: 'Senha incorreta.' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('401 para body sem senha ou não-JSON', async () => {
    expect((await POST(req({}))).status).toBe(401);
    const semJson = new Request('http://localhost/api/moderar/login', { method: 'POST', body: 'x' });
    expect((await POST(semJson)).status).toBe(401);
  });

  it('200 para senha certa, com cookie HttpOnly assinado e verificável', async () => {
    const res = await POST(req({ senha: 'senha-de-teste' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${COOKIE_MODERACAO}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 30}`);
    expect(cookie).not.toContain('Secure'); // fora de produção
    const token = cookie.split(';')[0].split('=')[1];
    expect(verificarToken(token, Date.now(), 'senha-de-teste')).toBe(true);
  });

  it('429 quando estoura o limite de tentativas — mesmo com a senha certa', async () => {
    contagem.valor = 10;
    const res = await POST(req({ senha: 'senha-de-teste' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
