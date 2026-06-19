import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cotacao, CotacaoRepo } from '@/types/cotacao';

export function supabaseRepo(client: SupabaseClient): CotacaoRepo {
  return {
    async ultimoValor(tipo) {
      const { data, error } = await client
        .from('cotacoes_historico')
        .select('valor')
        .eq('tipo', tipo)
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

      const ins = await client.from('cotacoes_historico').insert({
        tipo: cotacao.tipo,
        valor: cotacao.valor,
        fonte: cotacao.fonte,
        data_referencia: cotacao.dataReferencia,
      });
      if (ins.error) throw new Error(ins.error.message);
    },
  };
}
