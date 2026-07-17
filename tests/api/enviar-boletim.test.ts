import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarFotoArquivo: vi.fn(async () => ({ ok: true })) };
});

import { GET } from '@/app/api/enviar-boletim/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarFotoArquivo } from '@/lib/telegram';

const SECRET = 'segredo';
const enviar = enviarFotoArquivo as ReturnType<typeof vi.fn>;

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

// A rota agora BAIXA o card e envia os bytes (o Telegram não aguentava esperar o
// Satori desenhar a imagem quando ia buscar a URL sozinho).
function mockCard(ok = true) {
  const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, blob: async () => blob })),
  );
  return blob;
}

const req = (auth: string | null = `Bearer ${SECRET}`, qs = '') =>
  new Request(`http://localhost/api/enviar-boletim${qs}`, {
    headers: auth !== null ? { authorization: auth } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
  vi.stubEnv('TELEGRAM_DONO_CHAT_ID', '8896839605');
  mockCard();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/enviar-boletim', () => {
  it('401 com bearer errado/ausente, sem tocar no banco', async () => {
    const { select } = mockSupabase([1, 2]);
    expect((await GET(req('Bearer errado'))).status).toBe(401);
    expect((await GET(req(null))).status).toBe(401);
    expect(select).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('500 quando falta TELEGRAM_BOT_TOKEN', async () => {
    mockSupabase([1]);
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await GET(req())).status).toBe(500);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('500 quando a leitura dos inscritos falha', async () => {
    mockSupabase([], { message: 'boom' });
    expect((await GET(req())).status).toBe(500);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('caminho feliz: renderiza o card UMA vez e manda os bytes a cada inscrito', async () => {
    const { del } = mockSupabase([10, 20, 30]);
    const res = await GET(req());
    expect(res.status).toBe(200);

    // O card é buscado uma única vez, não uma vez por inscrito.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/api/boletim?d=');

    expect(enviar).toHaveBeenCalledTimes(3);
    const [token, id, imagem, caption] = enviar.mock.calls[0];
    expect(token).toBe('TOKEN123');
    expect(id).toBe(10);
    expect(imagem).toBeInstanceOf(Blob); // são os bytes, não a URL
    expect(caption).toContain('Praça Araguaia');
    expect(await res.json()).toEqual({ enviados: 3, removidos: 0, falhas: 0 });
    expect(del).not.toHaveBeenCalled();
  });

  it('502 quando o card não renderiza — não manda foto quebrada', async () => {
    mockSupabase([1]);
    mockCard(false);
    expect((await GET(req())).status).toBe(502);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('apaga os bloqueados (403) via .in ao fim', async () => {
    const { del, inFn } = mockSupabase([1, 2, 3]);
    enviar
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, bloqueado: true })
      .mockResolvedValueOnce({ ok: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(inFn).toHaveBeenCalledWith('chat_id', [2]);
    expect(await res.json()).toEqual({ enviados: 2, removidos: 1, falhas: 0 });
  });

  it('modo prévia manda SÓ para o dono, sem ler nem podar a lista de inscritos', async () => {
    const { select, del } = mockSupabase([10, 20, 30]); // inscritos existem, mas são ignorados
    const res = await GET(req(`Bearer ${SECRET}`, '?previa=1'));
    expect(res.status).toBe(200);
    // Não consulta a tabela de inscritos na prévia.
    expect(select).not.toHaveBeenCalled();
    // Envia uma vez, para o chat do dono.
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][1]).toBe(8896839605);
    expect(enviar.mock.calls[0][3]).toContain('Prévia');
    expect(del).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ enviados: 1, removidos: 0, falhas: 0 });
  });

  it('prévia sem TELEGRAM_DONO_CHAT_ID responde 500 e não envia', async () => {
    mockSupabase([10]);
    vi.stubEnv('TELEGRAM_DONO_CHAT_ID', '');
    const res = await GET(req(`Bearer ${SECRET}`, '?previa=1'));
    expect(res.status).toBe(500);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('lista vazia responde 200 zerado, sem renderizar card nem enviar', async () => {
    const { del } = mockSupabase([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviar).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ enviados: 0, removidos: 0, falhas: 0 });
  });
});
