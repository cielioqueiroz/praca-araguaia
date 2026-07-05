import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarFoto: vi.fn(async () => ({ ok: true })) };
});

import { GET } from '@/app/api/enviar-boletim/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarFoto } from '@/lib/telegram';

const SECRET = 'segredo';

function mockSupabase(chatIds: number[], selectError: unknown = null) {
  const inFn = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ in: inFn }));
  const select = vi.fn(async () => ({
    data: selectError ? null : chatIds.map((chat_id) => ({ chat_id })),
    error: selectError,
  }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ select, delete: del })),
  });
  return { select, del, inFn };
}

const req = (auth: string | null = `Bearer ${SECRET}`) =>
  new Request('http://localhost/api/enviar-boletim', {
    headers: auth !== null ? { authorization: auth } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/enviar-boletim', () => {
  it('401 com bearer errado/ausente, sem tocar no banco', async () => {
    const { select } = mockSupabase([1, 2]);
    expect((await GET(req('Bearer errado'))).status).toBe(401);
    expect((await GET(req(null))).status).toBe(401);
    expect(select).not.toHaveBeenCalled();
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('500 quando falta TELEGRAM_BOT_TOKEN', async () => {
    mockSupabase([1]);
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await GET(req())).status).toBe(500);
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('500 quando a leitura dos inscritos falha', async () => {
    mockSupabase([], { message: 'boom' });
    expect((await GET(req())).status).toBe(500);
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('caminho feliz: envia por inscrito e responde com o resumo', async () => {
    const { del, inFn } = mockSupabase([10, 20, 30]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarFoto).toHaveBeenCalledTimes(3);
    // chama com token, chatId, url do boletim e legenda
    const [token, id, url, caption] = (enviarFoto as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(token).toBe('TOKEN123');
    expect(id).toBe(10);
    expect(url).toContain('/api/boletim?d=');
    expect(caption).toContain('Praça Araguaia');
    expect(await res.json()).toEqual({ enviados: 3, removidos: 0, falhas: 0 });
    expect(del).not.toHaveBeenCalled();
  });

  it('apaga os bloqueados (403) via .in ao fim', async () => {
    const { del, inFn } = mockSupabase([1, 2, 3]);
    (enviarFoto as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, bloqueado: true })
      .mockResolvedValueOnce({ ok: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(inFn).toHaveBeenCalledWith('chat_id', [2]);
    expect(await res.json()).toEqual({ enviados: 2, removidos: 1, falhas: 0 });
  });

  it('lista vazia responde 200 zerado, sem enviar nem apagar', async () => {
    const { del } = mockSupabase([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarFoto).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ enviados: 0, removidos: 0, falhas: 0 });
  });
});
