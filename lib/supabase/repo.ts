import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Cotacao,
  CotacaoRepo,
  HistoricoRepo,
  PontoHistorico,
  PrecoPraca,
  PrecoPracaRepo,
  PrecoUf,
  PrecoUfRepo,
} from '@/types/cotacao';

export function supabaseRepo(
  client: SupabaseClient,
): CotacaoRepo & HistoricoRepo & PrecoUfRepo & PrecoPracaRepo {
  return {
    async ultimoValor(tipo, antesDe) {
      const { data, error } = await client
        .from('cotacoes_historico')
        .select('valor')
        .eq('tipo', tipo)
        .lt('data_referencia', antesDe)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? Number(data.valor) : null;
    },

    async salvar(cotacao: Cotacao, variacaoPct) {
      const up = await client.from('cotacoes').upsert(
        {
          tipo: cotacao.tipo,
          valor: cotacao.valor,
          unidade: cotacao.unidade,
          variacao_pct: variacaoPct,
          fonte: cotacao.fonte,
          data_referencia: cotacao.dataReferencia,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tipo' },
      );
      if (up.error) throw new Error(up.error.message);

      // upsert (não insert) para ser idempotente por dia: fontes com data sem
      // hora (BCB/Frankfurter) repetem a mesma data_referencia, e o ponto do dia
      // pode já existir pelo backfill — ignoramos a duplicata em vez de falhar.
      const ins = await client.from('cotacoes_historico').upsert(
        {
          tipo: cotacao.tipo,
          valor: cotacao.valor,
          fonte: cotacao.fonte,
          data_referencia: cotacao.dataReferencia,
        },
        { onConflict: 'tipo,data_referencia', ignoreDuplicates: true },
      );
      if (ins.error) throw new Error(ins.error.message);
    },

    async salvarPrecosUf(precos: PrecoUf[]) {
      if (precos.length === 0) return;
      const { error } = await client.from('cotacoes_uf').upsert(
        precos.map((p) => ({
          tipo: p.tipo,
          uf: p.uf,
          valor: p.valor,
          unidade: p.unidade,
          variacao_pct: p.variacaoPct,
          data_referencia: p.dataReferencia,
          atualizado_em: new Date().toISOString(),
        })),
        { onConflict: 'tipo,uf' },
      );
      if (error) throw new Error(error.message);
    },

    async salvarPrecosPraca(precos: PrecoPraca[]) {
      if (precos.length === 0) return;
      const { error } = await client.from('cotacoes_praca').upsert(
        precos.map((p) => ({
          tipo: p.tipo,
          praca: p.praca,
          uf: p.uf,
          valor: p.valor,
          unidade: p.unidade,
          variacao_pct: p.variacaoPct,
          valor_prazo: p.valorPrazo ?? null,
          data_referencia: p.dataReferencia,
          atualizado_em: new Date().toISOString(),
        })),
        { onConflict: 'tipo,praca,uf' },
      );
      if (error) throw new Error(error.message);

      // Apaga a praça que saiu da lista. O upsert só grava o que chega: quando o
      // dono cortou Cuiabá e Goiânia, elas continuaram no banco com o preço do dia
      // do corte e voltaram no card do Telegram como se fossem de hoje.
      //
      // Só mexe no `tipo` que acabou de chegar: se a Scot cair e o boi falhar, a
      // vaca não apaga o boi junto. E precos.length === 0 nunca chega aqui (sai
      // acima), então uma coleta vazia não limpa a tabela.
      const tipo = precos[0].tipo;
      const vivas = precos.map((p) => `${p.praca}|${p.uf}`);
      const { data: atuais, error: erroLeitura } = await client
        .from('cotacoes_praca')
        .select('id, praca, uf')
        .eq('tipo', tipo);
      if (erroLeitura) throw new Error(erroLeitura.message);

      const fantasmas = (atuais ?? []).filter((r) => !vivas.includes(`${r.praca}|${r.uf}`)).map((r) => r.id);
      if (fantasmas.length === 0) return;

      const { error: erroDelete } = await client.from('cotacoes_praca').delete().in('id', fantasmas);
      if (erroDelete) throw new Error(erroDelete.message);
    },

    async salvarHistoricoEmLote(tipo: string, fonte: string, pontos: PontoHistorico[]) {
      if (pontos.length === 0) return;
      const linhas = pontos.map((p) => ({
        tipo,
        valor: p.valor,
        fonte,
        data_referencia: p.data,
      }));
      const { error } = await client
        .from('cotacoes_historico')
        .upsert(linhas, { onConflict: 'tipo,data_referencia', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },

    async historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]> {
      const { data, error } = await client
        .from('cotacoes_historico')
        .select('valor, data_referencia')
        .eq('tipo', tipo)
        .gte('data_referencia', desde)
        .order('data_referencia', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ data: r.data_referencia as string, valor: Number(r.valor) }));
    },
  };
}
