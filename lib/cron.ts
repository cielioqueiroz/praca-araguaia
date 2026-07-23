import { createHash, timingSafeEqual } from 'node:crypto';

// Quem pode disparar as rotas de cron (/api/coletar, /api/backfill,
// /api/enviar-boletim, /api/alertas).
//
// POR QUE ISTO EXISTE: a comparação era `auth !== \`Bearer ${process.env.CRON_SECRET}\``.
// Com a env ausente, o segredo vira a string literal "Bearer undefined" — e a rota
// FALHA ABERTA. Duas dessas rotas fazem broadcast irreversível para os inscritos:
// um deploy sem a env (hoje, Preview não tem CRON_SECRET) seria um megafone aberto.
// Guarda explícita: sem segredo, ninguém entra.
//
// ---------------------------------------------------------------------------
// OS HORÁRIOS (o vercel.json é JSON e não aceita comentário — a razão mora aqui)
//
//   /api/coletar        22:00 UTC = 19:00 BRT  ← coleta, no fim da tarde
//   /api/enviar-boletim 12:20 UTC = 09:20 BRT  ← card do dia para os inscritos
//   /api/alertas        12:25 UTC = 09:25 BRT
//
// A COLETA MUDOU DE 09:00 PARA 19:00 BRT EM 23/07/2026, e este é o motivo:
//
// As páginas da Scot publicam o fechamento do dia à tarde. Coletando às 09:00 BRT,
// o app pegava a página ANTES da atualização e gravava o fechamento retrasado.
// Medido em 23/07/2026: a coleta das 09:40 gravou boi com fechamento de 21/07; às
// 20:27 do mesmo dia a página já mostrava 22/07 (e o bezerro, 23/07). Cada página
// estava exatamente uma publicação à frente do que o banco tinha.
//
// Efeito para quem recebe o card: o boletim de quinta trazia "Scot · 21/07" — dois
// dias atrás. Somado ao fim de semana, em que a Scot não publica, boi e vaca
// repetiam o mesmo número de sexta a terça. Foi o que o dono descreveu como "o gado
// congelou num preço antigo".
//
// Coletando às 19:00, o card da manhã seguinte carrega o fechamento mais novo que
// existe. De quebra, o Ibovespa passa a entrar com o fechamento real do pregão (que
// encerra às 17:00 BRT) em vez do número da véspera.
//
// O envio segue de manhã: o boletim é "bom dia", e o produtor lê o preço com que a
// praça abre o dia. São três crons porque o plano grátis da Vercel não dá mais.
// ---------------------------------------------------------------------------

/** SHA-256 dos dois lados iguala o comprimento, exigência do timingSafeEqual. */
function iguais(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function autorizadoPorCron(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    // Não é 500 na cara do chamador: quem bate na rota não precisa saber se a env
    // existe. O rastro fica no log, que é onde o dono procura.
    console.error('CRON_SECRET ausente: rota de cron negada a todos');
    return false;
  }
  const auth = req.headers.get('authorization');
  return auth !== null && iguais(auth, `Bearer ${segredo}`);
}
