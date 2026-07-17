import { createServerClient } from '@/lib/supabase/server';
import { validarFornecedor } from '@/lib/fornecedores';
import { ipHash } from '@/lib/ip';

export const dynamic = 'force-dynamic';

const LIMITE_24H = 3;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const validacao = validarFornecedor(body);
  if (validacao.tipo === 'honeypot') return Response.json({ recebido: true });
  if (validacao.tipo === 'invalido') return Response.json({ erro: validacao.erro }, { status: 400 });

  const supabase = createServerClient();
  const hash = ipHash(req);
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: erroContagem } = await supabase
    .from('fornecedores')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash)
    .gte('criado_em', desde);
  if (erroContagem) return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  if ((count ?? 0) >= LIMITE_24H) {
    return Response.json({ erro: 'Limite diário atingido — tente amanhã.' }, { status: 429 });
  }

  const f = validacao.fornecedor;
  const { error } = await supabase.from('fornecedores').insert({
    nome: f.nome,
    categoria: f.categoria,
    o_que_vende: f.oQueVende,
    municipio: f.municipio,
    whatsapp: f.whatsapp,
    ip_hash: hash,
  });
  if (error) return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  return Response.json({ recebido: true });
}
