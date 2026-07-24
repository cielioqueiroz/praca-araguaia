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
// SEGUNDA A SEXTA, sempre (`1-5` no cron). Feriado nacional é barrado dentro das
// rotas, em lib/dia-util.ts: o cron da Vercel sabe que dia da semana é hoje, mas
// não sabe que hoje é Natal.
//
// São QUATRO crons, e o plano aceita — conferido com `vercel crons ls` depois do
// deploy de 23/07/2026. (Havia aqui a anotação de que "o plano grátis só dá três";
// era chute, e estava errado.)
//
//   /api/enviar-boletim?sessao=abertura    10:30 UTC = 07:30 BRT
//   /api/coletar                           20:30 UTC = 17:30 BRT
//   /api/enviar-boletim?sessao=fechamento  21:00 UTC = 18:00 BRT
//   /api/alertas                           21:15 UTC = 18:15 BRT
//
// DUAS ENTREGAS POR DIA (23/07/2026, a pedido do dono):
//
//   ABERTURA, 07:30 — o preço com que o dia COMEÇA. À essa hora não existe dado
//   novo: a B3 abre às 10h e a Scot publica à tarde. Então o card leva o
//   fechamento do pregão anterior, que é literalmente o número com que o mercado
//   abre. A legenda diz isso com todas as letras, para ninguém achar que é o
//   preço de agora.
//
//   FECHAMENTO, 18:00 — depois que tudo fechou. A coleta roda 30 min antes, às
//   17:30: a B3 encerra às 17:00 e a Scot já publicou. É o card com o número do
//   dia apurado, e é ele que vale.
//
// A COLETA SAIU DE 09:00 PARA 17:30 BRT, e este é o motivo:
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
// Coletando às 17:30, o card do fechamento sai com o número do próprio dia, e o da
// manhã seguinte carrega o fechamento mais novo que existe. De quebra, o Ibovespa
// passa a entrar com o fechamento real do pregão em vez do número da véspera.
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
