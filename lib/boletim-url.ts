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

export type FormatoBoletim = 'completo' | 'telegram';

function assinatura(d: string, t: string, segredo: string, formato: FormatoBoletim): string {
  const carga = formato === 'telegram' ? `boletim.telegram.${d}.${t}` : `boletim.${d}.${t}`;
  return createHmac('sha256', segredo).update(carga).digest('hex').slice(0, 32);
}

export function assinarBoletim(d: string, t: string, segredo: string, formato: FormatoBoletim = 'completo'): string {
  return assinatura(d, t, segredo, formato);
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
  // Só uma segunda URL pública, fixa, para a prévia compacta do site. Continua
  // cacheável; qualquer variação exige assinatura para não multiplicar renders.
  if (chaves.length === 1 && params.get('f') === 'telegram') return true;

  // Chaves repetidas também criam infinitos cache misses com a mesma assinatura:
  // URLSearchParams.get lê só a primeira, mas o CDN cacheia a URL inteira.
  const formato = params.get('f') === 'telegram' ? 'telegram' : 'completo';
  const esperadas = formato === 'telegram' ? ['d', 't', 'f', 's'] : ['d', 't', 's'];
  if (chaves.length !== esperadas.length || !esperadas.every((k) => params.getAll(k).length === 1)) return false;
  if (params.has('f') && params.get('f') !== 'telegram') return false;

  const s = params.get('s');
  if (!segredo || !s) return false;

  const esperada = Buffer.from(assinatura(params.get('d') ?? '', params.get('t') ?? '', segredo, formato));
  const recebida = Buffer.from(s);
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}
