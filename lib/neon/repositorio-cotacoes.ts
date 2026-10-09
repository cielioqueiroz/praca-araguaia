import type { PoolClient } from 'pg';
import { obterPool } from '@/lib/neon/cliente';
import { variacaoDoLugar, dataDaUltimaMudanca, type LugarSalvo } from '@/lib/coleta';
import type {
  CotacaoRepo, HistoricoRepo, HistoricoLugarRepo, PontoLugar,
  PrecoPracaRepo, PrecoUfRepo,
} from '@/types/cotacao';

type RepositorioCotacoes = CotacaoRepo & HistoricoRepo & HistoricoLugarRepo & PrecoUfRepo & PrecoPracaRepo;

async function emTransacao(acao: (cliente: PoolClient) => Promise<void>): Promise<void> {
  const cliente = await obterPool(true).connect();
  let descartarConexao = false;
  try {
    await cliente.query('begin');
    await acao(cliente);
    await cliente.query('commit');
  } catch (erro) {
    try {
      await cliente.query('rollback');
    } catch {
      // Sem rollback confirmado, a conexão pode carregar uma transação quebrada.
      descartarConexao = true;
    }
    throw erro;
  } finally {
    if (descartarConexao) cliente.release(true);
    else cliente.release();
  }
}

function valoresEmLote(linhas: unknown[][]): { marcas: string; parametros: unknown[] } {
  const parametros: unknown[] = [];
  const marcas = linhas.map((linha) => `(${linha.map((valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  }).join(', ')})`).join(', ');
  return { marcas, parametros };
}

type NumeroDoBanco = number | string;
type DataDoBanco = Date | string;

function dataIso(valor: DataDoBanco): string {
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
}

function lugarSalvo(linha: {
  valor: NumeroDoBanco; variacao_pct: NumeroDoBanco | null;
  data_referencia: DataDoBanco; variou_em?: DataDoBanco | null;
}): LugarSalvo {
  return {
    valor: Number(linha.valor),
    variacaoPct: linha.variacao_pct === null ? null : Number(linha.variacao_pct),
    dataReferencia: dataIso(linha.data_referencia),
    variouEm: linha.variou_em ? dataIso(linha.variou_em) : linha.variou_em,
  };
}

// A conexão de escrita pertence somente às rotas de servidor. As leituras usadas
// por páginas passam pelo papel praca_leitura, preservando o limite de RLS.
export function repositorioCotacoesNeon(): RepositorioCotacoes {
  return {
    async ultimoValor(tipo, antesDe) {
      const resultado = await obterPool(false).query<{ valor: NumeroDoBanco }>(
        'select valor from cotacoes_historico where tipo = $1 and data_referencia < $2 order by data_referencia desc limit 1',
        [tipo, antesDe],
      );
      return resultado.rows[0] ? Number(resultado.rows[0].valor) : null;
    },

    async salvar(cotacao, variacaoPct) {
      await emTransacao(async (cliente) => {
        await cliente.query(
          `insert into cotacoes_historico (tipo, valor, fonte, data_referencia)
           values ($1, $2, $3, $4)
           on conflict (tipo, data_referencia) do nothing`,
          [cotacao.tipo, cotacao.valor, cotacao.fonte, cotacao.dataReferencia],
        );
        await cliente.query(
          `insert into cotacoes (tipo, valor, unidade, variacao_pct, fonte, data_referencia)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (tipo) do update set valor = excluded.valor, unidade = excluded.unidade,
             variacao_pct = excluded.variacao_pct, fonte = excluded.fonte,
             data_referencia = excluded.data_referencia, atualizado_em = now()`,
          [cotacao.tipo, cotacao.valor, cotacao.unidade, variacaoPct, cotacao.fonte, cotacao.dataReferencia],
        );
      });
    },

    async salvarPrecosUf(precos) {
      if (precos.length === 0) return;
      await emTransacao(async (cliente) => {
        const tipos = [...new Set(precos.map((preco) => preco.tipo))];
        const consulta = await cliente.query<{
          tipo: string; uf: string; valor: NumeroDoBanco;
          variacao_pct: NumeroDoBanco | null; data_referencia: DataDoBanco;
        }>('select tipo, uf, valor, variacao_pct, data_referencia from cotacoes_uf where tipo = any($1::text[]) for update', [tipos]);
        const anteriores = new Map(consulta.rows.map((linha) => [`${linha.tipo}|${linha.uf}`, lugarSalvo(linha)]));
        const historico = valoresEmLote(precos.map((preco) => [
          preco.tipo, 'uf', preco.uf, '', preco.valor, preco.unidade,
          ['boi', 'soja', 'milho'].includes(preco.tipo) ? 'conab' : 'scot', preco.dataReferencia,
        ]));
        await cliente.query(
          `insert into cotacoes_lugar_historico
             (tipo, recorte, uf, praca, valor, unidade, fonte, data_referencia)
           values ${historico.marcas}
           on conflict (tipo, recorte, uf, praca, data_referencia) do nothing`,
          historico.parametros,
        );
        const atuais = valoresEmLote(precos.map((preco) => [
          preco.tipo, preco.uf, preco.valor, preco.unidade,
          variacaoDoLugar(preco.valor, preco.dataReferencia, anteriores.get(`${preco.tipo}|${preco.uf}`), preco.variacaoPct),
          preco.dataReferencia,
        ]));
        await cliente.query(
          `insert into cotacoes_uf (tipo, uf, valor, unidade, variacao_pct, data_referencia)
           values ${atuais.marcas}
           on conflict (tipo, uf) do update set valor = excluded.valor, unidade = excluded.unidade,
             variacao_pct = excluded.variacao_pct, data_referencia = excluded.data_referencia,
             atualizado_em = now()`,
          atuais.parametros,
        );
      });
    },

    async salvarPrecosPraca(precos) {
      if (precos.length === 0) return;
      const tipo = precos[0].tipo;
      if (precos.some((preco) => preco.tipo !== tipo)) throw new Error('Lote de praças mistura produtos');
      await emTransacao(async (cliente) => {
        const consulta = await cliente.query<{
          id: number; tipo: string; praca: string; uf: string; valor: NumeroDoBanco;
          variacao_pct: NumeroDoBanco | null; data_referencia: DataDoBanco;
          variou_em: DataDoBanco | null;
        }>(
          `select id, tipo, praca, uf, valor, variacao_pct, data_referencia, variou_em
           from cotacoes_praca where tipo = $1 for update`, [tipo],
        );
        const anteriores = new Map(consulta.rows.map((linha) => [
          `${linha.tipo}|${linha.praca}|${linha.uf}`, lugarSalvo(linha),
        ]));
        const historico = valoresEmLote(precos.map((preco) => [
          preco.tipo, 'praca', preco.uf, preco.praca, preco.valor, preco.unidade, 'scot', preco.dataReferencia,
        ]));
        await cliente.query(
          `insert into cotacoes_lugar_historico
             (tipo, recorte, uf, praca, valor, unidade, fonte, data_referencia)
           values ${historico.marcas}
           on conflict (tipo, recorte, uf, praca, data_referencia) do nothing`,
          historico.parametros,
        );
        const atuais = valoresEmLote(precos.map((preco) => {
          const anterior = anteriores.get(`${preco.tipo}|${preco.praca}|${preco.uf}`);
          return [
            preco.tipo, preco.praca, preco.uf, preco.valor, preco.unidade,
            variacaoDoLugar(preco.valor, preco.dataReferencia, anterior, preco.variacaoPct),
            preco.valorPrazo ?? null, preco.dataReferencia,
            dataDaUltimaMudanca(preco.valor, preco.dataReferencia, anterior),
          ];
        }));
        await cliente.query(
          `insert into cotacoes_praca
             (tipo, praca, uf, valor, unidade, variacao_pct, valor_prazo, data_referencia, variou_em)
           values ${atuais.marcas}
           on conflict (tipo, praca, uf) do update set valor = excluded.valor,
             unidade = excluded.unidade, variacao_pct = excluded.variacao_pct,
             valor_prazo = excluded.valor_prazo, data_referencia = excluded.data_referencia,
             variou_em = excluded.variou_em, atualizado_em = now()`,
          atuais.parametros,
        );
        // Uma praça ausente da fonte sai do retrato, mas permanece no histórico.
        const vivas = new Set(precos.map((preco) => `${preco.praca}|${preco.uf}`));
        const fantasmas = consulta.rows.filter((linha) => !vivas.has(`${linha.praca}|${linha.uf}`)).map((linha) => linha.id);
        if (fantasmas.length > 0) {
          await cliente.query('delete from cotacoes_praca where id = any($1::bigint[])', [fantasmas]);
        }
      });
    },

    async salvarHistoricoEmLote(tipo, fonte, pontos) {
      if (pontos.length === 0) return;
      const lote = valoresEmLote(pontos.map((ponto) => [tipo, ponto.valor, fonte, ponto.data]));
      await obterPool(true).query(
        `insert into cotacoes_historico (tipo, valor, fonte, data_referencia)
         values ${lote.marcas} on conflict (tipo, data_referencia) do nothing`, lote.parametros,
      );
    },

    async historicoRecente(tipo, desde) {
      const resultado = await obterPool(false).query<{ valor: NumeroDoBanco; data_referencia: DataDoBanco }>(
        `select valor, data_referencia from cotacoes_historico
         where tipo = $1 and data_referencia >= $2 order by data_referencia asc`, [tipo, desde],
      );
      return resultado.rows.map((linha) => ({ valor: Number(linha.valor), data: dataIso(linha.data_referencia) }));
    },

    async historicoPorLugar(tipo, desde): Promise<PontoLugar[]> {
      const resultado = await obterPool(false).query<{
        tipo: string; recorte: 'praca' | 'uf'; uf: string; praca: string;
        valor: NumeroDoBanco; data_referencia: DataDoBanco;
      }>(
        `select tipo, recorte, uf, praca, valor, data_referencia
         from cotacoes_lugar_historico where tipo = $1 and data_referencia >= $2
         order by data_referencia asc`, [tipo, desde],
      );
      return resultado.rows.map((linha) => ({
        tipo: linha.tipo, recorte: linha.recorte, uf: linha.uf, praca: linha.praca,
        valor: Number(linha.valor), data: dataIso(linha.data_referencia),
      }));
    },

    async salvarHistoricoUfEmLote(tipo, fonte, linhas) {
      if (linhas.length === 0) return;
      const lote = valoresEmLote(linhas.map(({ uf, ponto, unidade }) => [
        tipo, 'uf', uf, '', ponto.valor, unidade, fonte, ponto.data,
      ]));
      await obterPool(true).query(
        `insert into cotacoes_lugar_historico
           (tipo, recorte, uf, praca, valor, unidade, fonte, data_referencia)
         values ${lote.marcas}
         on conflict (tipo, recorte, uf, praca, data_referencia) do nothing`, lote.parametros,
      );
    },
  };
}
