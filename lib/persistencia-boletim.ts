import { createServerClient } from '@/lib/supabase/server';
import { repositorioBoletimNeon, type EstadoColeta } from '@/lib/neon/repositorio-boletim';
import type { Sessao } from '@/lib/telegram-boletim';
import type { LinhaAtualizada } from '@/lib/boletim-envio';

export function persistenciaBoletim() {
  if (process.env.DATABASE_PROVIDER === 'neon') return repositorioBoletimNeon();
  const cliente = createServerClient();
  return {
    async listarInscritos(): Promise<number[]> {
      const { data, error } = await cliente.from('assinantes_telegram').select('chat_id');
      if (error) throw new Error(error.message);
      return (data ?? []).map((linha) => linha.chat_id as number);
    },
    async estadoColeta(): Promise<EstadoColeta> {
      const [cotacoes, pracas, ufs] = await Promise.all([
        cliente.from('cotacoes').select('tipo,atualizado_em'),
        cliente.from('cotacoes_praca').select('tipo,atualizado_em'),
        cliente.from('cotacoes_uf').select('tipo,atualizado_em'),
      ]);
      if (cotacoes.error || pracas.error || ufs.error) throw new Error('Leitura da coleta falhou');
      return {
        cotacoes: (cotacoes.data ?? []) as LinhaAtualizada[],
        pracas: (pracas.data ?? []) as LinhaAtualizada[],
        ufs: (ufs.data ?? []) as LinhaAtualizada[],
      };
    },
    async reservar(dia: string, sessao: Sessao): Promise<boolean> {
      const { error } = await cliente.from('envios_boletim').insert({ dia, sessao });
      if (error?.code === '23505') return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async removerBloqueados(chatIds: number[]): Promise<void> {
      if (chatIds.length === 0) return;
      const { error } = await cliente.from('assinantes_telegram').delete().in('chat_id', chatIds);
      if (error) throw new Error(error.message);
    },
    async concluir(dia: string, sessao: Sessao, enviados: number, removidos: number, falhas: number): Promise<void> {
      const { error } = await cliente.from('envios_boletim')
        .update({ concluido_em: new Date().toISOString(), enviados, removidos, falhas })
        .eq('dia', dia).eq('sessao', sessao);
      if (error) throw new Error(error.message);
    },
  };
}
