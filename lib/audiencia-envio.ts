import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarTexto } from './telegram';
import {
  resumirAudiencia,
  textoResumoAudiencia,
  type InscritoBruto,
  type VisitaBruta,
} from './audiencia';

// O resumo diário de audiência — para o DONO, e só para ele.
//
// ATENÇÃO: esta função manda para UM chat, o da env TELEGRAM_DONO_CHAT_ID. Ela
// nunca deve tocar em enviarEmMassa nem varrer a tabela de inscritos para enviar.
// Quem se inscreveu quer o boletim e o alerta de preço; mandar a lista de cidades
// da audiência no broadcast vazaria justamente o que esta fatia existe para
// proteger. Há um teste que trava isso.

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });
const fmtExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Araguaina' });

export type ResultadoResumo = { enviado: boolean; motivo?: string };

export async function enviarResumoAudiencia(
  supabase: SupabaseClient,
  token: string,
  agora: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoResumo> {
  const donoRaw = process.env.TELEGRAM_DONO_CHAT_ID;
  // Sem a env, não envia nada — e não é erro: é o estado de quem ainda não ligou.
  if (!donoRaw) return { enviado: false, motivo: 'sem TELEGRAM_DONO_CHAT_ID' };

  const dono = Number(donoRaw);
  if (!Number.isFinite(dono)) return { enviado: false, motivo: 'TELEGRAM_DONO_CHAT_ID inválido' };

  const hoje = fmtDia.format(agora);
  const seteDias = new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [inscritos, visitas] = await Promise.all([
    supabase.from('assinantes_telegram').select('cidade, uf'),
    supabase.from('visitas').select('dia, cidade, uf, acessos').gte('dia', fmtDia.format(seteDias)),
  ]);

  if (inscritos.error || visitas.error) {
    console.error('resumo de audiência: leitura falhou', inscritos.error ?? visitas.error);
    return { enviado: false, motivo: 'leitura falhou' };
  }

  const resumo = resumirAudiencia(
    (inscritos.data ?? []) as InscritoBruto[],
    (visitas.data ?? []) as VisitaBruta[],
    hoje,
  );

  const r = await enviarTexto(token, dono, textoResumoAudiencia(resumo, fmtExtenso.format(agora)), fetchImpl);
  return { enviado: r.ok };
}
