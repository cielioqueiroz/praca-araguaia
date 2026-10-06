import type { ResultadoEnvio } from '@/lib/telegram';

export type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number };

// Orquestrador puro de broadcast: percorre os chatIds e acumula o resultado.
// O efeito de rede entra por `enviar` (injetado), então é testável sem I/O.
export async function enviarEmMassa(args: {
  chatIds: number[];
  enviar: (chatId: number) => Promise<ResultadoEnvio>;
}): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, bloqueados: [], falhas: 0 };
  for (const chatId of args.chatIds) {
    try {
      const r = await args.enviar(chatId);
      if (r.ok) resumo.enviados++;
      else if (r.bloqueado) resumo.bloqueados.push(chatId);
      else resumo.falhas++;
    } catch {
      // Uma queda de rede neste chat não deve impedir os próximos inscritos.
      // O chat_id identifica uma pessoa; nem ele nem o erro de fetch (que pode
      // carregar o token do bot na URL) devem parar nos logs da plataforma.
      console.error('telegram-broadcast: envio falhou');
      resumo.falhas++;
    }
  }
  return resumo;
}
