const SITE = 'https://agroapp-bay.vercel.app';

// Mesmo fuso/formato do boletim PNG (lib/boletim.ts) — data determinística no
// serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
// YYYY-MM-DD no fuso local via 'en-CA' (formato ISO por padrão).
const fmtDataIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });

export function legendaBoletim(agora: Date): string {
  return (
    `☀️ Bom dia! Cotações da Praça Araguaia — ${fmtDataExtenso.format(agora)}. ` +
    `Veja o painel completo em agroapp-bay.vercel.app\n\n` +
    `Criado por Cielio Queiroz.`
  );
}

export function urlFotoBoletim(agora: Date): string {
  // O Telegram cacheia foto remota POR URL: reenviar a mesma URL devolve o arquivo
  // que ele já baixou, não o card novo. Com só ?d=<data>, um segundo envio no mesmo
  // dia (depois de um deploy, por exemplo) reentregava o card velho. O minuto do
  // envio torna a URL única — e também fura o cache do CDN (s-maxage 1h).
  const minuto = Math.floor(agora.getTime() / 60_000);
  return `${SITE}/api/boletim?d=${fmtDataIso.format(agora)}&t=${minuto}`;
}
