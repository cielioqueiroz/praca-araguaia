import { criarToken, verificarSenha, COOKIE_MODERACAO, VALIDADE_TOKEN_MS } from '@/lib/moderacao';
import { createServerClient } from '@/lib/supabase/server';
import { ipHash } from '@/lib/ip';

export const dynamic = 'force-dynamic';

// Espera fixa em TODA resposta: freia força bruta sem vazar timing.
const ESPERA_MS = process.env.NODE_ENV === 'test' ? 0 : 800;
const espera = () => new Promise((r) => setTimeout(r, ESPERA_MS));

// A espera sozinha só encarece o ataque; ela não o termina. Dez tentativas em quinze
// minutos é folgado para quem esqueceu a senha e curto para quem está adivinhando.
const LIMITE = 10;
const JANELA_MS = 15 * 60 * 1000;

/** Sem contador, a senha não pode ser testada sem limite. */
async function excedeuLimite(hash: string): Promise<boolean | null> {
  try {
    const supabase = createServerClient();
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const { count, error } = await supabase
      .from('tentativas_login')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', hash)
      .gte('criado_em', desde);
    if (error) {
      console.error('login: contagem de tentativas falhou', error);
      return null;
    }
    return (count ?? 0) >= LIMITE;
  } catch (e) {
    console.error('login: contagem de tentativas falhou', e);
    return null;
  }
}

async function registrarTentativa(hash: string): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from('tentativas_login').insert({ ip_hash: hash });
    if (error) {
      console.error('login: registro de tentativa falhou', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('login: registro de tentativa falhou', e);
    return false;
  }
}

export async function POST(req: Request) {
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
  const senha = process.env.MODERACAO_SENHA;
  if (!senha) {
    return Response.json({ erro: 'Moderação não configurada.' }, { status: 500 });
  }

  if (!process.env.CRON_SECRET) {
    return Response.json({ erro: 'Moderação não configurada.' }, { status: 500 });
  }
  const hash = ipHash(req);
  const excedeu = await excedeuLimite(hash);
  if (excedeu === null) {
    return Response.json({ erro: 'Login temporariamente indisponível.' }, { status: 503 });
  }
  if (excedeu) {
    return Response.json({ erro: 'Muitas tentativas — espere 15 minutos.' }, { status: 429 });
  }

  // POR QUE ISTO EXISTE: se a leitura funciona mas a escrita de tentativas falha,
  // conferir a senha abriria tentativas ilimitadas. Conta inclusive o acerto.
  if (!(await registrarTentativa(hash))) {
    return Response.json({ erro: 'Login temporariamente indisponível.' }, { status: 503 });
  }

  if (!verificarSenha(tentativa, senha)) {
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const token = criarToken(Date.now(), senha);
  const atributos = [
    `${COOKIE_MODERACAO}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${VALIDADE_TOKEN_MS / 1000}`,
  ];
  if (process.env.NODE_ENV === 'production') atributos.push('Secure');

  return Response.json({ ok: true }, { headers: { 'set-cookie': atributos.join('; ') } });
}
