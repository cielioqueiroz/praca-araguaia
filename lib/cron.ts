import { createHash, timingSafeEqual } from 'node:crypto';

// POR QUE ISTO EXISTE: comparar o header com um segredo ausente aceitava a string
// literal "Bearer undefined". As rotas protegidas incluem broadcast irreversível;
// sem CRON_SECRET, a autorização falha fechada.
//
// Em 06/10/2026, vercel.json agenda só a coleta (20:30 UTC) e o fechamento
// (21:00 UTC), de segunda a sexta. A rota barra feriados em dia-util.ts.
// Na Vercel Hobby, cada cron pode iniciar em qualquer momento da hora agendada;
// a reserva em envios_boletim evita duplicar o fechamento. Abertura, alertas e
// resumo de audiência permanecem sem cron. A Scot divulga o gado D-1; o card
// traz a data da fonte mesmo quando a coleta foi feita hoje. O histórico da
// pausa e retomada está em ESTADO-DO-PROJETO.md.

/** SHA-256 dos dois lados iguala o comprimento, exigência do timingSafeEqual. */
function iguais(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function autorizadoPorCron(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    // Não revela a configuração ao chamador; o rastro fica no log do servidor.
    console.error('CRON_SECRET ausente: rota de cron negada a todos');
    return false;
  }
  const auth = req.headers.get('authorization');
  return auth !== null && iguais(auth, `Bearer ${segredo}`);
}
