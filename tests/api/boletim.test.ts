import { describe, it, expect, vi, beforeEach } from 'vitest';

// ImageResponse real depende de WASM (Satori/resvg) — mock devolve um Response
// com os headers passados; o PNG de verdade é verificado ponta a ponta na Task 4.
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(_el: unknown, opts?: { headers?: Record<string, string> }) {
      return new Response('png-simulado', {
        status: 200,
        headers: { 'content-type': 'image/png', ...(opts?.headers ?? {}) },
      });
    }
  },
}));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn() }));
vi.mock('@/lib/boletim', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/boletim')>();
  return { ...orig, montarBoletim: vi.fn(orig.montarBoletim) };
});

import { GET } from '@/app/api/boletim/route';
import { createPublicClient } from '@/lib/supabase/public';
import { montarBoletim } from '@/lib/boletim';

const mockClient = (retorno: { data: unknown; error: unknown }) => {
  (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ select: async () => retorno }),
  });
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/boletim', () => {
  it('200 com content-type de imagem quando há cotações', async () => {
    mockClient({
      data: [{ tipo: 'boi', valor: 326.96, unidade: 'R$/@', variacao_pct: -1.54 }],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\//);
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('200 mesmo com o banco vazio (card de estado vazio)', async () => {
    mockClient({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('500 quando o Supabase falha', async () => {
    mockClient({ data: null, error: { message: 'boom' } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('preserva variacao_pct null na conversão (não vira 0)', async () => {
    mockClient({
      data: [{ tipo: 'ouro', valor: 21000, unidade: 'R$', variacao_pct: null }],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(montarBoletim).toHaveBeenCalledWith([
      { tipo: 'ouro', valor: 21000, unidade: 'R$', variacao_pct: null },
    ]);
  });
});
