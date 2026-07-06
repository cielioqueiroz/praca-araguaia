import { createServerClient } from '@/lib/supabase/server';
import { lerTokenDoCookie, verificarToken } from '@/lib/moderacao';
import { validarDecisaoFornecedor, type DecisaoFornecedor } from '@/lib/fornecedores';

export const dynamic = 'force-dynamic';

// Aprovar/rejeitar só de pendente; remover só de aprovado.
const ORIGEM: Record<DecisaoFornecedor, 'pendente' | 'aprovado'> = {
  aprovado: 'pendente',
  rejeitado: 'pendente',
  removido: 'aprovado',
};

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
  const validacao = validarDecisaoFornecedor(body);
  if (validacao.tipo === 'invalido') return Response.json({ erro: validacao.erro }, { status: 400 });

  // Só a origem permitida muda; as linhas afetadas dizem se algo mudou (sem TOCTOU).
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('fornecedores')
    .update({ status: validacao.decisao })
    .eq('id', validacao.id)
    .eq('status', ORIGEM[validacao.decisao])
    .select('id');
  if (error) return Response.json({ erro: 'Erro ao salvar. Tente de novo.' }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ erro: 'Fornecedor não encontrado ou já resolvido.' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
