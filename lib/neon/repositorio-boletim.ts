import { obterPool } from '@/lib/neon/cliente';
import type { LinhaAtualizada } from '@/lib/boletim-envio';
import type { Sessao } from '@/lib/telegram-boletim';

export type EstadoColeta = {
  cotacoes: LinhaAtualizada[];
  pracas: LinhaAtualizada[];
  ufs: LinhaAtualizada[];
};

export function repositorioBoletimNeon() {
  return {
    async listarInscritos(): Promise<number[]> {
      const resultado = await obterPool(true).query<{ chat_id: number }>('select chat_id from assinantes_telegram');
      return resultado.rows.map((linha) => linha.chat_id);
    },

    async estadoColeta(): Promise<EstadoColeta> {
      const pool = obterPool(true);
      const [cotacoes, pracas, ufs] = await Promise.all([
        pool.query<LinhaAtualizada>('select tipo, atualizado_em from cotacoes'),
        pool.query<LinhaAtualizada>('select tipo, atualizado_em from cotacoes_praca'),
        pool.query<LinhaAtualizada>('select tipo, atualizado_em from cotacoes_uf'),
      ]);
      return { cotacoes: cotacoes.rows, pracas: pracas.rows, ufs: ufs.rows };
    },

    async reservar(dia: string, sessao: Sessao): Promise<boolean> {
      const resultado = await obterPool(true).query(
        `insert into envios_boletim (dia, sessao) values ($1, $2)
         on conflict (dia, sessao) do nothing`, [dia, sessao],
      );
      return resultado.rowCount === 1;
    },

    async removerBloqueados(chatIds: number[]): Promise<void> {
      if (chatIds.length === 0) return;
      await obterPool(true).query('delete from assinantes_telegram where chat_id = any($1::bigint[])', [chatIds]);
    },

    async concluir(dia: string, sessao: Sessao, enviados: number, removidos: number, falhas: number): Promise<void> {
      const resultado = await obterPool(true).query(
        `update envios_boletim set concluido_em = now(), enviados = $3, removidos = $4, falhas = $5
         where dia = $1 and sessao = $2`, [dia, sessao, enviados, removidos, falhas],
      );
      if (resultado.rowCount !== 1) throw new Error('Reserva do boletim não encontrada ao concluir');
    },
  };
}
