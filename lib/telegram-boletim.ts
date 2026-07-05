import type { ResultadoEnvio } from '@/lib/telegram';

const SITE = 'https://agroapp-bay.vercel.app';

// Mesmo fuso/formato do boletim PNG (lib/boletim.ts) — data determinística no
// serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
// YYYY-MM-DD no fuso local via 'en-CA' (formato ISO por padrão).
const fmtDataIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });

export function legendaBoletim(agora: Date): string {
  return (
    `☀️ Bom dia! Cotações da Praça Araguaia — ${fmtDataExtenso.format(agora)}. ` +
    `Veja o painel completo em agroapp-bay.vercel.app`
  );
}

export function urlFotoBoletim(agora: Date): string {
  // ?d=<data local> é cache-buster: garante o boletim fresco do dia (CDN 1h).
  return `${SITE}/api/boletim?d=${fmtDataIso.format(agora)}`;
}

export type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number };

// Orquestrador puro: percorre os chatIds e acumula o resultado. O efeito de rede
// entra por `enviar` (injetado), então isto é testável sem I/O.
export async function enviarBoletim(args: {
  chatIds: number[];
  enviar: (chatId: number) => Promise<ResultadoEnvio>;
}): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, bloqueados: [], falhas: 0 };
  for (const chatId of args.chatIds) {
    const r = await args.enviar(chatId);
    if (r.ok) resumo.enviados++;
    else if (r.bloqueado) resumo.bloqueados.push(chatId);
    else resumo.falhas++;
  }
  return resumo;
}
