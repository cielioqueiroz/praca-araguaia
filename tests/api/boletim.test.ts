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

// Sem query: é o card do dia, que a rota sempre libera (o CDN o cacheia). A defesa
// contra o cache-buster assinado vive em tests/boletim-url.test.ts.
const req = () => new Request('http://localhost/api/boletim');

// A rota faz 3 consultas: cotacoes (select), cotacoes_uf (select) e reportes
// (select + eq + eq + gte). O mock encadeia os filtros e responde por tabela.
const mockClient = (
  cotacoes: { data: unknown; error: unknown },
  cotacoesUf: unknown[] = [],
  reportes: unknown[] = [],
) => {
  (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (tabela: string) => ({
      select: () => {
        if (tabela === 'cotacoes') return Promise.resolve(cotacoes);
        if (tabela === 'cotacoes_uf') return Promise.resolve({ data: cotacoesUf, error: null });
        const filtro = {
          eq: () => filtro,
          gte: () => Promise.resolve({ data: reportes, error: null }),
        };
        return filtro;
      },
    }),
  });
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/boletim', () => {
  it('200 com content-type de imagem quando há cotações', async () => {
    mockClient({
      data: [{ tipo: 'dolar', valor: 5.1072, unidade: 'R$', variacao_pct: 0.11 }],
      error: null,
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\//);
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('200 mesmo com o banco vazio (card de estado vazio)', async () => {
    mockClient({ data: [], error: null });
    const res = await GET(req());
    expect(res.status).toBe(200);
  });

  it('500 quando o Supabase falha', async () => {
    mockClient({ data: null, error: { message: 'boom' } });
    const res = await GET(req());
    expect(res.status).toBe(500);
  });

  it('leva o preço por UF e as cidades do Termômetro para o card', async () => {
    mockClient(
      { data: [{ tipo: 'ouro', valor: 678.23, unidade: 'R$/g', variacao_pct: null }], error: null },
      [
        {
          tipo: 'boi',
          uf: 'PA',
          valor: 329.55,
          unidade: 'R$/@',
          variacao_pct: -3,
          data_referencia: '2026-07-03T03:00:00.000Z',
        },
      ],
      [{ produto: 'boi', municipio: 'Redenção', valor: 305 }],
    );

    const res = await GET(req());
    expect(res.status).toBe(200);

    const [linhas, precosUf, cidades] = (montarBoletim as ReturnType<typeof vi.fn>).mock.calls[0];
    // variacao_pct null tem de continuar null (não virar 0).
    expect(linhas).toEqual([{ tipo: 'ouro', valor: 678.23, unidade: 'R$/g', variacao_pct: null }]);
    expect(precosUf).toEqual([
      {
        tipo: 'boi',
        uf: 'PA',
        valor: 329.55,
        unidade: 'R$/@',
        variacaoPct: -3,
        dataReferencia: '2026-07-03T03:00:00.000Z',
      },
    ]);
    // As cidades vão etiquetadas por produto — o card pendura cada uma no seu.
    expect(cidades).toContainEqual({ produto: 'boi', municipio: 'Redenção', uf: 'PA', mediana: 305, contagem: 1 });
    // O reporte de boi não pode aparecer como se fosse de vaca.
    expect(cidades).toContainEqual({ produto: 'vaca', municipio: 'Redenção', uf: 'PA', mediana: null, contagem: 0 });
    // Cidade sem reporte continua na lista (é convite), com mediana nula.
    expect(cidades).toContainEqual({ produto: 'boi', municipio: 'Confresa', uf: 'MT', mediana: null, contagem: 0 });
    // 6 produtos da porteira × 5 cidades da praça.
    expect(cidades).toHaveLength(30);
  });
});
