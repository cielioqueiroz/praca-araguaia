import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/fornecedores/route';
import { createServerClient } from '@/lib/supabase/server';

function mockSupabase({ count = 0, countError = null, insertError = null }: {
  count?: number; countError?: unknown; insertError?: unknown;
} = {}) {
  const insert = vi.fn(async () => ({ error: insertError }));
  const gte = vi.fn(async () => ({ count, error: countError }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ select, insert })),
  });
  return { insert };
}

const req = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://localhost/api/fornecedores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });

const valido = {
  nome: 'Casa Agro',
  categoria: 'racao-sal',
  oQueVende: 'ração e sal',
  municipio: 'Redenção',
  whatsapp: '(94) 99999-8888',
  contato: '',
};

beforeEach(() => vi.clearAllMocks());

describe('POST /api/fornecedores', () => {
  it('200 grava pendente com o_que_vende, whatsapp normalizado e ip_hash (sem IP puro)', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req(valido));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recebido: true });
    const gravado = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).toMatchObject({
      nome: 'Casa Agro',
      categoria: 'racao-sal',
      o_que_vende: 'ração e sal',
      municipio: 'Redenção',
      whatsapp: '5594999998888',
    });
    expect(String(gravado.ip_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(gravado.ip_hash)).not.toContain('1.2.3.4');
    expect('status' in gravado).toBe(false); // default do banco
  });

  it('400 para envio inválido, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, whatsapp: '123' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('honeypot: 200 de mentira, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, contato: 'sou bot' }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('429 quando o IP já mandou 3 em 24h', async () => {
    const { insert } = mockSupabase({ count: 3 });
    const res = await POST(req(valido));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it('500 quando o banco falha no insert', async () => {
    mockSupabase({ insertError: { message: 'boom' } });
    expect((await POST(req(valido))).status).toBe(500);
  });

  it('corpo que não é JSON vira 400', async () => {
    mockSupabase();
    const res = await POST(new Request('http://localhost/api/fornecedores', { method: 'POST', body: 'nao-json' }));
    expect(res.status).toBe(400);
  });
});
