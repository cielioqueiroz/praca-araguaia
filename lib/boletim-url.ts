import { createHmac, timingSafeEqual } from 'node:crypto';

// A URL do card do dia — e a assinatura que impede que ela vire uma torneira de CPU.
//
// POR QUE ISTO EXISTE: /api/boletim é pública e desenha o PNG em ~8s de função. O
// CDN da Vercel cacheia por URL INTEIRA, então qualquer query nova é um cache miss:
// `?t=1`, `?t=2`, `?x=oi`… Um laço de curl queima a cota do plano grátis e derruba o
// site todo — não só o card. Medido em produção em 17/07/2026: 7,8s por chamada.
//
// A saída: o público só alcança a URL SEM query, que o CDN serve por 1h. Qualquer
// query precisa vir assinada, e só quem tem o CRON_SECRET assina — hoje, o envio
// diário do Telegram, que precisa de URL única para o Telegram não servir do cache
// dele o card de ontem.

function assinatura(d: string, t: string, segredo: string): string {
  return createHmac('sha256', segredo).update(`boletim.${d}.${t}`).digest('hex').slice(0, 32);
}

export function assinarBoletim(d: string, t: string, segredo: string): string {
  return assinatura(d, t, segredo);
}

/**
 * A requisição pode desenhar o card?
 *
 * Sem query: sim, sempre — é o card do dia, cacheado, que a página /boletim mostra.
 * Com query: só com `s` batendo com `d` e `t`. Sem CRON_SECRET, nenhuma query passa.
 */
export function boletimLiberado(url: URL, segredo: string | undefined): boolean {
  const params = url.searchParams;
  const chaves = [...params.keys()];
  if (chaves.length === 0) return true;

  // Só estas três chaves, e nada além: `?d=…&t=…&s=…&x=7` traria assinatura válida e
  // ainda assim furaria o cache pelo `x`, que ninguém assinou.
  if (!chaves.every((k) => k === 'd' || k === 't' || k === 's')) return false;

  const s = params.get('s');
  if (!segredo || !s) return false;

  const esperada = Buffer.from(assinatura(params.get('d') ?? '', params.get('t') ?? '', segredo));
  const recebida = Buffer.from(s);
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}
