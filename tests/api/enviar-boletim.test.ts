import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarFotoArquivo: vi.fn(async () => ({ ok: true })) };
});

import { GET } from '@/app/api/enviar-boletim/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarFotoArquivo } from '@/lib/telegram';
import { ORDEM_PAINEL } from '@/lib/tipos-ui';

const SECRET = 'segredo';
const enviar = enviarFotoArquivo as ReturnType<typeof vi.fn>;

function mockSupabase(chatIds: number[], selectError: unknown = null, cotacaoPendente = false) {
  const inFn = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ in: inFn }));
  const select = vi.fn(async () => ({
    data: selectError ? null : chatIds.map((chat_id) => ({ chat_id })),
    error: selectError,
  }));
  const hoje = '2026-07-23T13:00:00.000Z';
  const ontem = '2026-07-22T13:00:00.000Z';
  const linhas = (tipos: readonly string[]) => tipos.map((tipo) => ({
    tipo,
    atualizado_em: tipo === 'dolar' && cotacaoPendente ? ontem : hoje,
  }));
  const dados: Record<string, { tipo: string; atualizado_em: string }[]> = {
    cotacoes: linhas(ORDEM_PAINEL),
    cotacoes_praca: linhas(['boi', 'vaca']),
    cotacoes_uf: linhas(['novilha', 'bezerro', 'soja', 'milho']),
  };
  const reservas = new Set<string>();
  const insert = vi.fn(async ({ dia, sessao }: { dia: string; sessao: string }) => {
    const chave = `${dia}:${sessao}`;
    if (reservas.has(chave)) return { error: { code: '23505' } };
    reservas.add(chave);
    return { error: null };
  });
  const eqFinal = vi.fn(async () => ({ error: null }));
  const eqInicial = vi.fn(() => ({ eq: eqFinal }));
  const update = vi.fn(() => ({ eq: eqInicial }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn((tabela: string) => {
      if (tabela === 'assinantes_telegram') return { select, delete: del };
      if (tabela === 'envios_boletim') return { insert, update };
      return { select: vi.fn(async () => ({ data: dados[tabela], error: null })) };
    }),
  });
  return { select, del, inFn, insert, update };
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

// QUINTA-FEIRA, 23/07/2026 — dia útil. O relógio fica preso de propósito: desde
// que a rota passou a pular fim de semana e feriado, um teste que usasse a data
// real falharia todo sábado e todo Natal, sem nada ter quebrado. Só o Date é
// falseado; os timers de verdade continuam valendo para o código assíncrono.
const QUINTA_UTIL = new Date('2026-07-23T13:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(QUINTA_UTIL);
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
  vi.stubEnv('TELEGRAM_DONO_CHAT_ID', '123456789');
  mockCard();
});
afterEach(() => {
  vi.useRealTimers();
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
    const { insert } = mockSupabase([1]);
    mockCard(false);
    expect((await GET(req())).status).toBe(502);
    expect(enviar).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('503 e nenhuma reserva quando a coleta do dólar ficou para trás', async () => {
    const { insert } = mockSupabase([1], null, true);
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ pendencias: ['cotacoes:dolar'] });
    expect(fetch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('a segunda chamada do dia não envia novamente', async () => {
    const { insert, update } = mockSupabase([1, 2]);
    expect((await GET(req())).status).toBe(200);
    const repetida = await GET(req());
    expect(await repetida.json()).toMatchObject({ pulado: 'envio ja iniciado' });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('não repete os envios bem-sucedidos depois de falha parcial', async () => {
    mockSupabase([1, 2, 3]);
    enviar.mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, bloqueado: false })
      .mockResolvedValueOnce({ ok: true });
    const primeira = await GET(req());
    expect(await primeira.json()).toMatchObject({ enviados: 2, falhas: 1 });
    expect((await GET(req())).status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(3);
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
    expect(enviar.mock.calls[0][1]).toBe(123456789);
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

  // ------------------------------------------------------------------
  // Só dia útil (23/07/2026, a pedido do dono). O card fala de pregão e de arroba
  // negociada: sem mercado aberto ele repetiria o número de sexta com a data de
  // hoje — a mesma cara de "congelado" que motivou esta rodada de correções.
  // ------------------------------------------------------------------
  it('não envia no sábado, e diz por quê', async () => {
    vi.setSystemTime(new Date('2026-07-25T13:00:00.000Z')); // sábado
    const { select } = mockSupabase([1, 2, 3]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviar).not.toHaveBeenCalled();
    // Nem chega a ler a lista de inscritos: sai antes de tocar no banco.
    expect(select).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ enviados: 0, pulado: 'fim de semana' });
  });

  it('não envia em feriado nacional, mesmo caindo em dia de semana', async () => {
    vi.setSystemTime(new Date('2026-12-25T13:00:00.000Z')); // Natal, uma sexta
    mockSupabase([1, 2, 3]);
    const res = await GET(req());
    expect(enviar).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ pulado: 'feriado nacional: Natal' });
  });

  it('a prévia do dono passa mesmo no domingo', async () => {
    // Ela vai só para o chat do dono — que pode querer conferir a peça justamente
    // no domingo, porque é quando sobra tempo.
    vi.setSystemTime(new Date('2026-07-26T13:00:00.000Z')); // domingo
    mockSupabase([1, 2, 3]);
    const res = await GET(req(`Bearer ${SECRET}`, '?previa=1'));
    expect(res.status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('a sessão muda a legenda: abertura de manhã, fechamento à tarde', async () => {
    mockSupabase([10]);
    await GET(req(`Bearer ${SECRET}`, '?sessao=abertura'));
    expect(enviar.mock.calls[0][3]).toContain('como o mercado abre');

    enviar.mockClear();
    await GET(req(`Bearer ${SECRET}`, '?sessao=fechamento'));
    expect(enviar.mock.calls[0][3]).toContain('boletim de fechamento');
  });
});
