import { describe, expect, it } from 'vitest';
import { pendenciasDaColeta } from '@/lib/boletim-envio';
import { ORDEM_PAINEL } from '@/lib/tipos-ui';

const dia = '2026-10-06';
const atualizacao = '2026-10-06T20:31:00.000Z';
const linhas = (tipos: string[]) => tipos.map((tipo) => ({ tipo, atualizado_em: atualizacao }));

describe('pendenciasDaColeta', () => {
  it('libera o boletim quando todos os dados usados no card foram coletados no dia', () => {
    expect(
      pendenciasDaColeta(dia, {
        cotacoes: linhas(ORDEM_PAINEL),
        pracas: linhas(['boi', 'vaca']),
        ufs: linhas(['novilha', 'bezerro', 'soja', 'milho']),
      }),
    ).toEqual([]);
  });

  it('aponta preço de mercado velho e uma praça ausente sem tratar a coleta parcial como completa', () => {
    const cotacoes = linhas(ORDEM_PAINEL).map((linha) =>
      linha.tipo === 'dolar' ? { ...linha, atualizado_em: '2026-10-05T21:25:00.000Z' } : linha,
    );
    expect(
      pendenciasDaColeta(dia, {
        cotacoes,
        pracas: linhas(['boi']),
        ufs: linhas(['novilha', 'bezerro', 'soja', 'milho']),
      }),
    ).toEqual(['cotacoes:dolar', 'pracas:vaca']);
  });

  it('olha todas as linhas do produto para impedir que um estado velho passe despercebido', () => {
    expect(
      pendenciasDaColeta(dia, {
        cotacoes: linhas(ORDEM_PAINEL),
        pracas: linhas(['boi', 'vaca']),
        ufs: [...linhas(['novilha', 'bezerro', 'soja', 'milho']), { tipo: 'milho', atualizado_em: '2026-10-05T21:25:00.000Z' }],
      }),
    ).toEqual(['ufs:milho']);
  });
});
