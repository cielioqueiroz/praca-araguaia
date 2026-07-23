import { describe, it, expect, vi } from 'vitest';
import { coletarCotacao, variacaoDoLugar } from '@/lib/coleta';
import type { Cotacao, CotacaoRepo } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.50, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

function repoMock(ultimo: number | null): CotacaoRepo {
  return {
    ultimoValor: vi.fn().mockResolvedValue(ultimo),
    salvar: vi.fn().mockResolvedValue(undefined),
  };
}

describe('coletarCotacao', () => {
  it('calcula a variação percentual contra o último valor', async () => {
    const repo = repoMock(5.00);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeCloseTo(10); // (5.5-5)/5 = 10%
    expect(repo.ultimoValor).toHaveBeenCalledWith(cotacao.tipo, cotacao.dataReferencia);
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, expect.closeTo(10, 2));
  });

  it('variação nula na primeira coleta (sem histórico)', async () => {
    const repo = repoMock(null);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeNull();
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, null);
  });

  it('recoleta do mesmo ponto (dado semanal repetido) mantém a variação da semana anterior', async () => {
    // fonte semanal (boi/soja/milho) devolve o mesmo dataReferencia em dias
    // seguidos do cron diário; o "anterior" já exclui esse próprio ponto
    // (repo.ultimoValor filtra data_referencia < antesDe), então a variação
    // não deve ser zerada.
    const repo = repoMock(5.00);
    const r1 = await coletarCotacao(async () => cotacao, repo);
    const r2 = await coletarCotacao(async () => cotacao, repo);
    expect(r1.variacaoPct).toBeCloseTo(10);
    expect(r2.variacaoPct).toBeCloseTo(10);
  });

  it('não grava se a fonte falhar', async () => {
    const repo = repoMock(5.00);
    await expect(
      coletarCotacao(async () => { throw new Error('fonte fora'); }, repo)
    ).rejects.toThrow('fonte fora');
    expect(repo.salvar).not.toHaveBeenCalled();
  });

  it('propaga erro de escrita', async () => {
    const repo = repoMock(5.00);
    (repo.salvar as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db fora'));
    await expect(coletarCotacao(async () => cotacao, repo)).rejects.toThrow('db fora');
  });
});

// ---------------------------------------------------------------------------
// A variação de um LUGAR (praça da Scot, estado da CONAB).
//
// POR QUE ISTO EXISTE (23/07/2026): boi e vaca por praça, e novilha e bezerro por
// estado, chegavam sempre com variacaoPct null — a Scot não publica variação nessas
// páginas. No card do Telegram, o gado inteiro saía sem seta enquanto soja e milho
// mostravam a delas: o dono leu o gado como "congelado". O banco já guarda o preço
// anterior de cada lugar; a variação sai da comparação com ele.
// ---------------------------------------------------------------------------
describe('variacaoDoLugar', () => {
  const anterior = (valor: number, dataReferencia: string, variacaoPct: number | null = null) =>
    ({ valor, dataReferencia, variacaoPct });

  it('calcula contra o preço anterior daquele mesmo lugar', () => {
    // Marabá: 310,00 no fechamento de ontem, 316,50 no de hoje → +2,10%
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(310, '2026-07-21'), null)).toBeCloseTo(2.1, 2);
    expect(variacaoDoLugar(303.5, '2026-07-22', anterior(310, '2026-07-21'), null)).toBeCloseTo(-2.1, 2);
  });

  it('a variação da própria fonte ganha da calculada', () => {
    // A CONAB publica a variação da semana no arquivo; recalcular por cima dela
    // trocaria o número do apurador pelo nosso.
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(310, '2026-07-21'), -1.25)).toBe(-1.25);
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(310, '2026-07-21'), 0)).toBe(0);
  });

  it('sem preço anterior, não inventa variação', () => {
    expect(variacaoDoLugar(316.5, '2026-07-22', undefined, null)).toBeNull();
  });

  it('recoleta do MESMO fechamento preserva a variação — não zera', () => {
    // O cron roda todo dia, mas a Scot não publica sábado nem domingo. Comparar o
    // fechamento de sexta com ele mesmo daria 0% e apagaria a alta real de sexta —
    // exatamente o "congelado" que o dono viu.
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(316.5, '2026-07-22', 2.1), null)).toBeCloseTo(2.1, 2);
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(316.5, '2026-07-22', null), null)).toBeNull();
  });

  it('fonte que volta no tempo não vira variação ao contrário', () => {
    // Se a página republicar um fechamento antigo, o certo é manter o que se sabia,
    // não anunciar uma queda que só existe porque a data andou para trás.
    expect(variacaoDoLugar(310, '2026-07-20', anterior(316.5, '2026-07-22', 2.1), null)).toBeCloseTo(2.1, 2);
  });

  it('preço anterior zerado ou negativo não vira divisão por zero', () => {
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(0, '2026-07-21'), null)).toBeNull();
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(-3, '2026-07-21'), null)).toBeNull();
  });

  it('preço parado entre dois fechamentos dá 0, e 0 é um fato', () => {
    // Diferente de null: aqui SABEMOS que não mexeu. O card mostra traço neutro.
    expect(variacaoDoLugar(316.5, '2026-07-22', anterior(316.5, '2026-07-21'), null)).toBe(0);
  });
});
