import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repositorioCotacoesNeon } from '@/lib/neon/repositorio-cotacoes';
import { repositorioBoletimNeon } from '@/lib/neon/repositorio-boletim';
import { repositorioModeracaoNeon } from '@/lib/neon/repositorio-moderacao';

const banco = vi.hoisted(() => ({
  transacao: vi.fn(async (_sql: string, _parametros?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> => ({ rows: [], rowCount: 1 })),
  escrita: vi.fn(async (_sql: string, _parametros?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> => ({ rows: [], rowCount: 1 })),
  leitura: vi.fn(async (_sql: string, _parametros?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> => ({ rows: [], rowCount: 1 })),
  liberar: vi.fn(),
}));

vi.mock('@/lib/neon/cliente', () => ({
  obterPool: (escrita: boolean) => escrita
    ? {
        connect: async () => ({ query: banco.transacao, release: banco.liberar }),
        query: banco.escrita,
      }
    : { query: banco.leitura },
}));

beforeEach(() => {
  vi.clearAllMocks();
  banco.transacao.mockResolvedValue({ rows: [], rowCount: 1 });
  banco.escrita.mockResolvedValue({ rows: [], rowCount: 1 });
  banco.leitura.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('repositório de cotações no Neon', () => {
  it('reverte histórico e cotação juntos quando o retrato falha', async () => {
    banco.transacao.mockImplementation(async (sql: string) => {
      if (sql.includes('insert into cotacoes (')) throw new Error('retrato indisponível');
      return { rows: [], rowCount: 1 };
    });

    await expect(repositorioCotacoesNeon().salvar({
      tipo: 'boi', valor: 340, unidade: 'R$/@', fonte: 'scot', dataReferencia: '2026-10-08T03:00:00Z',
    }, 1.5)).rejects.toThrow('retrato indisponível');

    const consultas = banco.transacao.mock.calls.map(([sql]) => sql);
    expect(consultas[0]).toBe('begin');
    expect(consultas.some((sql) => sql.includes('insert into cotacoes_historico'))).toBe(true);
    expect(consultas.at(-1)).toBe('rollback');
    expect(consultas).not.toContain('commit');
    expect(banco.liberar).toHaveBeenCalledOnce();
  });

  it('preserva o erro original e descarta a conexão se o rollback falha', async () => {
    const erroOriginal = new Error('retrato indisponível');
    banco.transacao.mockImplementation(async (sql: string) => {
      if (sql.includes('insert into cotacoes (')) throw erroOriginal;
      if (sql === 'rollback') throw new Error('conexão perdida');
      return { rows: [], rowCount: 1 };
    });

    await expect(repositorioCotacoesNeon().salvar({
      tipo: 'boi', valor: 340, unidade: 'R$/@', fonte: 'scot', dataReferencia: '2026-10-08T03:00:00Z',
    }, 1.5)).rejects.toBe(erroOriginal);
    expect(banco.liberar).toHaveBeenCalledWith(true);
  });

  it('mantém a variação de um fechamento repetido por UF na mesma transação do histórico', async () => {
    banco.transacao.mockImplementation(async (sql: string) => sql.includes('select tipo, uf')
      ? { rows: [{ tipo: 'novilha', uf: 'PA', valor: '3000.00', variacao_pct: '2.50', data_referencia: new Date('2026-10-08T03:00:00Z') }], rowCount: 1 }
      : { rows: [], rowCount: 1 });

    await repositorioCotacoesNeon().salvarPrecosUf([{
      tipo: 'novilha', uf: 'PA', valor: 3000, unidade: 'R$/cabeça', variacaoPct: null,
      dataReferencia: '2026-10-08T03:00:00Z',
    }]);

    const consultas = banco.transacao.mock.calls;
    expect(consultas[0][0]).toBe('begin');
    expect(consultas.some(([sql]) => sql.includes('insert into cotacoes_lugar_historico'))).toBe(true);
    const atual = consultas.find(([sql]) => sql.includes('insert into cotacoes_uf'));
    expect(atual?.[1]).toEqual(['novilha', 'PA', 3000, 'R$/cabeça', 2.5, '2026-10-08T03:00:00Z']);
    expect(consultas.at(-1)?.[0]).toBe('commit');
  });

  it('reverte a coleta por praça se a limpeza das praças ausentes falha', async () => {
    banco.transacao.mockImplementation(async (sql: string) => {
      if (sql.includes('from cotacoes_praca where tipo')) return {
        rows: [
          { id: 1, tipo: 'boi', praca: 'Redenção', uf: 'PA', valor: '340.00', variacao_pct: '1.20',
            data_referencia: new Date('2026-10-07T03:00:00Z'), variou_em: new Date('2026-10-05T03:00:00Z') },
          { id: 2, tipo: 'boi', praca: 'Cuiabá', uf: 'MT', valor: 330, variacao_pct: 0,
            data_referencia: '2026-10-07T03:00:00Z', variou_em: '2026-10-07T03:00:00Z' },
        ], rowCount: 2,
      };
      if (sql.includes('delete from cotacoes_praca')) throw new Error('limpeza indisponível');
      return { rows: [], rowCount: 1 };
    });

    await expect(repositorioCotacoesNeon().salvarPrecosPraca([{
      tipo: 'boi', uf: 'PA', praca: 'Redenção', valor: 340, unidade: 'R$/@', variacaoPct: null,
      dataReferencia: '2026-10-08T03:00:00Z',
    }])).rejects.toThrow('limpeza indisponível');

    const consultas = banco.transacao.mock.calls;
    const atual = consultas.find(([sql]) => sql.includes('insert into cotacoes_praca'));
    expect(atual?.[1]?.[5]).toBe(0);
    expect(atual?.[1]?.[8]).toBe('2026-10-05T03:00:00.000Z');
    expect(consultas.find(([sql]) => sql.includes('delete from cotacoes_praca'))?.[1]).toEqual([[2]]);
    expect(consultas.at(-1)?.[0]).toBe('rollback');
  });

  it('devolve número e datas ISO nas leituras do driver pg', async () => {
    banco.leitura.mockImplementation(async (sql: string) => {
      if (sql.includes('select valor from cotacoes_historico')) {
        return { rows: [{ valor: '353.0000' }], rowCount: 1 };
      }
      if (sql.includes('from cotacoes_lugar_historico')) {
        return { rows: [{ tipo: 'boi', recorte: 'praca', uf: 'PA', praca: 'Redenção',
          valor: '353.0000', data_referencia: new Date('2026-10-08T03:00:00Z') }], rowCount: 1 };
      }
      return { rows: [{ valor: '353.0000', data_referencia: new Date('2026-10-08T03:00:00Z') }], rowCount: 1 };
    });

    const repo = repositorioCotacoesNeon();
    expect(await repo.ultimoValor('boi', '2026-10-09T03:00:00Z')).toBe(353);
    expect(await repo.historicoRecente('boi', '2026-10-01T03:00:00Z')).toEqual([
      { valor: 353, data: '2026-10-08T03:00:00.000Z' },
    ]);
    expect(await repo.historicoPorLugar('boi', '2026-10-01T03:00:00Z')).toEqual([
      { tipo: 'boi', recorte: 'praca', uf: 'PA', praca: 'Redenção', valor: 353,
        data: '2026-10-08T03:00:00.000Z' },
    ]);
  });
});

describe('repositório de boletim no Neon', () => {
  it('entrega datas ISO no estado da coleta', async () => {
    banco.escrita.mockResolvedValue({
      rows: [{ tipo: 'boi', atualizado_em: new Date('2026-10-09T20:30:00Z') }], rowCount: 1,
    });
    expect(await repositorioBoletimNeon().estadoColeta()).toEqual({
      cotacoes: [{ tipo: 'boi', atualizado_em: '2026-10-09T20:30:00.000Z' }],
      pracas: [{ tipo: 'boi', atualizado_em: '2026-10-09T20:30:00.000Z' }],
      ufs: [{ tipo: 'boi', atualizado_em: '2026-10-09T20:30:00.000Z' }],
    });
  });

  it('converte IDs bigint do pg antes de enviar ao Telegram', async () => {
    banco.escrita.mockResolvedValue({ rows: [{ chat_id: '-1001234567890' }], rowCount: 1 });
    expect(await repositorioBoletimNeon().listarInscritos()).toEqual([-1001234567890]);
  });

  it('recusa ID bigint que perderia precisão antes do envio', async () => {
    banco.escrita.mockResolvedValue({ rows: [{ chat_id: '9007199254740993' }], rowCount: 1 });
    await expect(repositorioBoletimNeon().listarInscritos()).rejects.toThrow('intervalo seguro');
  });

  it('reserva um fechamento uma só vez pela chave do banco', async () => {
    banco.escrita.mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const repo = repositorioBoletimNeon();
    expect(await repo.reservar('2026-10-08', 'fechamento')).toBe(true);
    expect(await repo.reservar('2026-10-08', 'fechamento')).toBe(false);
    expect(banco.escrita.mock.calls[0][0]).toContain('on conflict (dia, sessao) do nothing');
  });
});

describe('repositório de moderação no Neon', () => {
  it('só decide um reporte que ainda está pendente', async () => {
    banco.escrita.mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const repo = repositorioModeracaoNeon();
    expect(await repo.decidirReporte('id-do-reporte', 'aprovado')).toBe(true);
    expect(await repo.decidirReporte('id-do-reporte', 'rejeitado')).toBe(false);
    expect(banco.escrita.mock.calls[0][0]).toContain("status = 'pendente'");
  });
});
