import { criarToken, verificarSenha, COOKIE_MODERACAO } from '@/lib/moderacao';

export const dynamic = 'force-dynamic';

// Espera fixa em TODA resposta: freia força bruta sem vazar timing.
const ESPERA_MS = process.env.NODE_ENV === 'test' ? 0 : 800;
const espera = () => new Promise((r) => setTimeout(r, ESPERA_MS));

export async function POST(req: Request) {
  const senha = process.env.MODERACAO_SENHA;
  if (!senha) {
    return Response.json({ erro: 'Moderação não configurada.' }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // corpo inválido cai no caminho de senha errada, com a mesma espera
  }
  const tentativa =
    typeof body === 'object' && body !== null && typeof (body as { senha?: unknown }).senha === 'string'
      ? ((body as { senha: string }).senha)
      : '';

  await espera();
  if (!verificarSenha(tentativa, senha)) {
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const token = criarToken(Date.now(), senha);
  const atributos = [
    `${COOKIE_MODERACAO}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (process.env.NODE_ENV === 'production') atributos.push('Secure');

  return Response.json({ ok: true }, { headers: { 'set-cookie': atributos.join('; ') } });
}
