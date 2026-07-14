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
  // ?d=<data local> é cache-buster: garante o boletim fresco do dia (CDN 1h).
  return `${SITE}/api/boletim?d=${fmtDataIso.format(agora)}`;
}
