import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cotacao, CotacaoRepo, HistoricoRepo, PontoHistorico } from '@/types/cotacao';

export function supabaseRepo(client: SupabaseClient): CotacaoRepo & HistoricoRepo {
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
