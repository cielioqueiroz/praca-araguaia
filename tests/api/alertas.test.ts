import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarTexto: vi.fn(async () => ({ ok: true })) };
});

import { GET } from '@/app/api/alertas/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarTexto } from '@/lib/telegram';

const SECRET = 'segredo';
const boiMover = { tipo: 'boi', valor: 340.1, unidade: 'R$/@', variacao_pct: 4.2, data_referencia: '2026-07-06' };
const dolarCalmo = { tipo: 'dolar', valor: 5.1, unidade: 'R$', variacao_pct: 0.4, data_referencia: '2026-07-06' };

function mockSupabase({
  cotacoes = [] as unknown[],
  jaEnviados = [] as unknown[],
  chatIds = [] as number[],
  cotErro = null as unknown,
  jaErro = null as unknown,
} = {}) {
  const inFn = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ in: inFn }));
  const insert = vi.fn(async () => ({ error: null }));
  const selCot = vi.fn(async () => ({ data: cotErro ? null : cotacoes, error: cotErro }));
  const selJa = vi.fn(async () => ({ data: jaErro ? null : jaEnviados, error: jaErro }));
  const selSub = vi.fn(async () => ({ data: chatIds.map((chat_id) => ({ chat_id })), error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'cotacoes') return { select: selCot };
    if (table === 'alertas_enviados') return { select: selJa, insert };
    if (table === 'assinantes_telegram') return { select: selSub, delete: del };
    throw new Error('tabela inesperada: ' + table);
  });
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, insert, del, inFn, selCot };
}

const req = (auth: string | null = `Bearer ${SECRET}`) =>
  new Request('http://localhost/api/alertas', { headers: auth !== null ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/alertas', () => {
  it('401 com bearer errado/ausente, sem tocar no banco', async () => {
    const { selCot } = mockSupabase({ cotacoes: [boiMover] });
    expect((await GET(req('Bearer errado'))).status).toBe(401);
    expect((await GET(req(null))).status).toBe(401);
    expect(selCot).not.toHaveBeenCalled();
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('500 quando falta TELEGRAM_BOT_TOKEN', async () => {
    mockSupabase({ cotacoes: [boiMover] });
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await GET(req())).status).toBe(500);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('500 quando a leitura de cotacoes falha', async () => {
    mockSupabase({ cotErro: { message: 'boom' } });
    expect((await GET(req())).status).toBe(500);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('sem movers → 200 zerado, nada enviado', async () => {
    const { insert } = mockSupabase({ cotacoes: [dolarCalmo] });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alertados: 0, enviados: 0, removidos: 0, falhas: 0 });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('caminho feliz: envia por inscrito e grava marcador', async () => {
    const { insert, del } = mockSupabase({ cotacoes: [boiMover, dolarCalmo], chatIds: [10, 20] });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarTexto).toHaveBeenCalledTimes(2);
    const [token, id, texto] = (enviarTexto as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(token).toBe('TOKEN123');
    expect(id).toBe(10);
    expect(texto).toContain('Boi gordo');
    expect(insert).toHaveBeenCalledWith([{ tipo: 'boi', data_referencia: '2026-07-06', variacao_pct: 4.2 }]);
    expect(del).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ alertados: 1, enviados: 2, removidos: 0, falhas: 0 });
  });

  it('dedup: mover já avisado é filtrado → não envia', async () => {
    const { insert } = mockSupabase({
      cotacoes: [boiMover],
      jaEnviados: [{ tipo: 'boi', data_referencia: '2026-07-06' }],
      chatIds: [10],
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ alertados: 0, enviados: 0, removidos: 0, falhas: 0 });
  });

  it('remove bloqueados (403) via .in ao fim', async () => {
    const { del, inFn } = mockSupabase({ cotacoes: [boiMover], chatIds: [1, 2, 3] });
    (enviarTexto as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, bloqueado: true })
      .mockResolvedValueOnce({ ok: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(inFn).toHaveBeenCalledWith('chat_id', [2]);
    expect(await res.json()).toEqual({ alertados: 1, enviados: 2, removidos: 1, falhas: 0 });
  });
});
