import { createHmac } from 'node:crypto';

// Identidade grosseira de quem envia, para os limites diários — sem guardar IP.
//
// POR QUE HMAC E NÃO SHA-256: o IPv4 inteiro são ~4 bilhões de valores. Um SHA-256
// sem sal é uma tabela que qualquer placa de vídeo constrói em minutos — ou seja, o
// hash "anônimo" era o IP com uma fantasia. Com o sal, quem levar o dump do banco
// não desfaz nada sem o segredo, que nunca sai do servidor.
//
// O sal é o CRON_SECRET porque ele já existe, é server-only e não custa mais uma env
// para o dono criar. Se um dia ele mudar, o único efeito é que as janelas de 24h dos
// limites recomeçam uma vez — nada que o usuário perceba.

export function ipHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  const sal = process.env.CRON_SECRET || 'sem-sal';
  return createHmac('sha256', sal).update(ip).digest('hex');
}
