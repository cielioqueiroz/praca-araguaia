import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Decisao } from './moderacao-tipos';

export { tempoRelativo, type ReportePendente, type Decisao } from './moderacao-tipos';

export const COOKIE_MODERACAO = 'moderacao';
export const VALIDADE_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// Assinado com a própria senha: trocar a senha derruba todas as sessões.
function assinar(expira: number, senha: string): string {
  return createHmac('sha256', senha).update(`moderador.${expira}`).digest('hex');
}

export function criarToken(agora: number, senha: string): string {
  const expira = agora + VALIDADE_TOKEN_MS;
  return `${expira}.${assinar(expira, senha)}`;
}

export function verificarToken(token: string, agora: number, senha: string): boolean {
  const [expiraStr, assinatura, ...sobra] = token.split('.');
  const expira = Number(expiraStr);
  if (sobra.length > 0 || !Number.isFinite(expira) || !assinatura) return false;
  if (agora >= expira) return false;
  const recebida = Buffer.from(assinatura, 'hex');
  const esperada = Buffer.from(assinar(expira, senha), 'hex');
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

// SHA-256 de ambas iguala os comprimentos, exigência do timingSafeEqual.
export function verificarSenha(tentativa: string, senha: string): boolean {
  const a = createHash('sha256').update(tentativa).digest();
  const b = createHash('sha256').update(senha).digest();
  return timingSafeEqual(a, b);
}

export function lerTokenDoCookie(header: string | null): string | null {
  if (!header) return null;
  for (const par of header.split(';')) {
    const [nome, ...resto] = par.trim().split('=');
    if (nome === COOKIE_MODERACAO) {
      const valor = resto.join('=');
      return valor === '' ? null : valor;
    }
  }
  return null;
}

export type ValidacaoDecisao =
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; id: string; decisao: Decisao };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarDecisao(body: unknown): ValidacaoDecisao {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) {
    return { tipo: 'invalido', erro: 'Reporte inválido.' };
  }
  if (b.decisao !== 'aprovado' && b.decisao !== 'rejeitado') {
    return { tipo: 'invalido', erro: 'Decisão inválida.' };
  }
  return { tipo: 'valido', id: b.id, decisao: b.decisao };
}
