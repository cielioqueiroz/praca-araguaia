import { createHash, timingSafeEqual } from 'node:crypto';

// Quem pode disparar as rotas de cron (/api/coletar, /api/backfill,
// /api/enviar-boletim, /api/alertas).
//
// POR QUE ISTO EXISTE: a comparação era `auth !== \`Bearer ${process.env.CRON_SECRET}\``.
// Com a env ausente, o segredo vira a string literal "Bearer undefined" — e a rota
// FALHA ABERTA. Duas dessas rotas fazem broadcast irreversível para os inscritos:
// um deploy sem a env (hoje, Preview não tem CRON_SECRET) seria um megafone aberto.
// Guarda explícita: sem segredo, ninguém entra.

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
