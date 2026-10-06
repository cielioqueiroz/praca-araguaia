import { assinarBoletim } from './boletim-url';

const SITE = 'https://agroapp-bay.vercel.app';

// Mesmo fuso/formato do boletim PNG (lib/boletim.ts) — data determinística no
// serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
// YYYY-MM-DD no fuso local via 'en-CA' (formato ISO por padrão).
const fmtDataIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });

/**
 * As duas sessões do dia.
 *
 * 'abertura' é uma prévia manual com as referências disponíveis no começo do dia.
 * 'fechamento' é o único envio automático, após a coleta. Cada fonte tem sua data:
 * a Scot fecha o dia útil anterior e a CONAB publica por semana.
 *
 * A legenda diz qual é qual, e por quê: dois cards por dia sem essa distinção
 * pareceriam a mesma mensagem repetida — e um card que parece repetido é
 * exatamente o que fez o dono achar que o sistema estava congelado.
 */
export type Sessao = 'abertura' | 'fechamento';

export function legendaBoletim(agora: Date, sessao: Sessao = 'abertura'): string {
  const cabeca =
    sessao === 'abertura'
      ? `☀️ Bom dia! Praça Araguaia — como o mercado abre, ${fmtDataExtenso.format(agora)}.\n` +
        `Referências disponíveis ao começar o dia, com a data de cada fonte no card.`
      : `🌇 Praça Araguaia — boletim de fechamento, ${fmtDataExtenso.format(agora)}.\n` +
        `Preços de referência das fontes, com a data de cada apuração no card.`;

  return (
    `${cabeca}\n\n` +
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
  return `${SITE}/api/boletim?d=${d}&t=${minuto}&f=telegram&s=${assinarBoletim(d, minuto, segredo, 'telegram')}`;
}
