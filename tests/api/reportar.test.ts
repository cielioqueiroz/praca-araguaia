import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/reportar/route';
import { createServerClient } from '@/lib/supabase/server';

// Mock encadeável: count de reportes recentes por IP + insert.
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
  new Request('http://localhost/api/reportar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });

const valido = { produto: 'boi', municipio: 'Redenção', valor: 320, contato: '' };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/reportar', () => {
  it('200 grava reporte pendente com ip_hash (sem IP puro)', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req(valido));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recebido: true });
    const gravado = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).toMatchObject({ produto: 'boi', municipio: 'Redenção', valor: 320 });
    expect(String(gravado.ip_hash)).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
    expect(String(gravado.ip_hash)).not.toContain('1.2.3.4');
  });

  it('400 para reporte inválido, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, valor: 5 }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('honeypot: 200 de mentira, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, contato: 'sou um bot' }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('429 quando o IP já mandou 5 em 24h', async () => {
    const { insert } = mockSupabase({ count: 5 });
    const res = await POST(req(valido));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it('500 quando o banco falha no insert', async () => {
    mockSupabase({ insertError: { message: 'boom' } });
    const res = await POST(req(valido));
    expect(res.status).toBe(500);
  });

  it('corpo que não é JSON vira 400', async () => {
    mockSupabase();
    const res = await POST(new Request('http://localhost/api/reportar', { method: 'POST', body: 'nao-json' }));
    expect(res.status).toBe(400);
  });
});
