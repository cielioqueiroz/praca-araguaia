import { createServerClient } from '@/lib/supabase/server';
import { lerTokenDoCookie, verificarToken } from '@/lib/moderacao';
import { validarReporte } from '@/lib/termometro';

export const dynamic = 'force-dynamic';

/**
 * O preço que a Praça apurou entra por aqui — e só por aqui.
 *
 * Mesma validação do formulário público (produto da lista, município da lista, valor
 * dentro da faixa plausível): apuração nossa não ganha licença para digitar o que
 * quiser. O que muda é quem pode chamar (cookie da moderação) e o que fica gravado:
 * `origem = 'praca'` e já `aprovado`, porque quem lança é quem aprovaria.
 *
 * Ver docs/adr/0003-reporte-apurado-pela-praca.md.
 */
export async function POST(req: Request) {
  const senha = process.env.MODERACAO_SENHA;
  const token = lerTokenDoCookie(req.headers.get('cookie'));
  if (!senha || !token || !verificarToken(token, Date.now(), senha)) {
    return Response.json({ erro: 'Sessão inválida — entre de novo.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const validacao = validarReporte(body);
  if (validacao.tipo === 'honeypot' || validacao.tipo === 'invalido') {
    const erro = validacao.tipo === 'invalido' ? validacao.erro : 'Envio inválido.';
    return Response.json({ erro }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from('reportes').insert({
    ...validacao.reporte,
    status: 'aprovado',
    origem: 'praca',
  });
  if (error) {
    return Response.json({ erro: 'Erro ao salvar. Tente de novo.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
