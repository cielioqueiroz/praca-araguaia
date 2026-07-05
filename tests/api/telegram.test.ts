import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarMensagem: vi.fn(async () => {}) };
});

import { POST } from '@/app/api/telegram/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarMensagem } from '@/lib/telegram';

const SECRET = 'seg-red-o';

function mockSupabase() {
  const upsert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ eq }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ upsert, delete: del })),
  });
  return { upsert, del, eq };
}

const req = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/api/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret !== null ? { 'x-telegram-bot-api-secret-token': secret } : {}),
    },
    body: JSON.stringify(body),
  });

const msg = (text: string, id = 42) => ({ message: { text, chat: { id } } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/telegram', () => {
  it('401 quando o secret do header está errado/ausente, sem tocar no banco', async () => {
    const { upsert } = mockSupabase();
    expect((await POST(req(msg('/start'), 'errado'))).status).toBe(401);
    expect((await POST(req(msg('/start'), null))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('500 quando falta env do bot', async () => {
    mockSupabase();
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await POST(req(msg('/start')))).status).toBe(500);
  });

  it('/start faz upsert do chat_id e manda boas-vindas', async () => {
    const { upsert } = mockSupabase();
    const res = await POST(req(msg('/start')));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ chat_id: 42 }, { onConflict: 'chat_id', ignoreDuplicates: true });
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('boletim'));
  });

  it('/parar apaga o chat_id e manda despedida', async () => {
    const { del, eq } = mockSupabase();
    const res = await POST(req(msg('/parar')));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('chat_id', 42);
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('saiu'));
  });

  it('texto qualquer manda ajuda, sem tocar no banco', async () => {
    const { upsert, del } = mockSupabase();
    const res = await POST(req(msg('bom dia')));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('/start'));
  });

  it('update sem texto responde 200 sem ação', async () => {
    const { upsert } = mockSupabase();
    const res = await POST(req({ update_id: 1 }));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(enviarMensagem).not.toHaveBeenCalled();
  });
});
