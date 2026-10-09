import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repositorio = vi.hoisted(() => ({
  decidirReporte: vi.fn(async (_id: string, _decisao: string) => true),
  decidirFornecedor: vi.fn(async (_id: string, _decisao: string) => true),
  registrarReporteDaPraca: vi.fn(async (_reporte: unknown) => undefined),
}));

vi.mock('@/lib/neon/repositorio-moderacao', () => ({
  repositorioModeracaoNeon: vi.fn(() => repositorio),
}));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST as decidirReporte } from '@/app/api/moderar/decidir/route';
import { POST as decidirFornecedor } from '@/app/api/moderar/fornecedor/route';
import { POST as registrarReporte } from '@/app/api/moderar/reporte/route';
import { createServerClient } from '@/lib/supabase/server';
import { COOKIE_MODERACAO, criarToken } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function pedido(caminho: string, corpo: unknown): Request {
  return new Request(`http://localhost/api/moderar/${caminho}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`,
    },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DATABASE_PROVIDER', 'neon');
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('moderação no Neon', () => {
  it('decide reporte pelo repositório SQL e distingue linha já moderada', async () => {
    expect((await decidirReporte(pedido('decidir', { id: UUID, decisao: 'aprovado' }))).status).toBe(200);
    expect(repositorio.decidirReporte).toHaveBeenCalledWith(UUID, 'aprovado');

    repositorio.decidirReporte.mockResolvedValueOnce(false);
    expect((await decidirReporte(pedido('decidir', { id: UUID, decisao: 'rejeitado' }))).status).toBe(404);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('decide fornecedor pelo repositório SQL', async () => {
    expect((await decidirFornecedor(pedido('fornecedor', { id: UUID, decisao: 'removido' }))).status).toBe(200);
    expect(repositorio.decidirFornecedor).toHaveBeenCalledWith(UUID, 'removido');
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('registra apuração da Praça pelo repositório SQL após validar o valor', async () => {
    expect((await registrarReporte(pedido('reporte', {
      produto: 'novilha', municipio: 'Redenção', valor: 3000,
    }))).status).toBe(200);
    expect(repositorio.registrarReporteDaPraca).toHaveBeenCalledWith({
      produto: 'novilha', municipio: 'Redenção', valor: 3000,
    });
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
