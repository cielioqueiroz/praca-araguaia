import { assinarBoletim } from './boletim-url';

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

export function urlFotoBoletim(agora: Date, segredo: string): string {
  // O Telegram cacheia foto remota POR URL: reenviar a mesma URL devolve o arquivo
  // que ele já baixou, não o card novo. Com só ?d=<data>, um segundo envio no mesmo
  // dia (depois de um deploy, por exemplo) reentregava o card velho. O minuto do
  // envio torna a URL única — e também fura o cache do CDN (s-maxage 1h).
  //
  // E é justamente por furar o cache que ela vai ASSINADA: furar o cache é caro (~8s
  // de função por render), então esse poder é de quem tem o CRON_SECRET, não do
  // primeiro que descobrir o formato da URL.
  const minuto = String(Math.floor(agora.getTime() / 60_000));
  const d = fmtDataIso.format(agora);
  return `${SITE}/api/boletim?d=${d}&t=${minuto}&s=${assinarBoletim(d, minuto, segredo)}`;
}
