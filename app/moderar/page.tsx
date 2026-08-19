import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { verificarToken, COOKIE_MODERACAO, type ReportePendente } from '@/lib/moderacao';
import { PRODUTOS, type ProdutoTermometro } from '@/lib/termometro';
import { CATEGORIAS, type FornecedorModeravel } from '@/lib/fornecedores';
import { FormLoginModeracao } from '@/components/FormLoginModeracao';
import { AbasModeracao } from '@/components/AbasModeracao';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Moderação',
  robots: { index: false },
};

export default async function Moderar() {
  const senha = process.env.MODERACAO_SENHA;
  const token = (await cookies()).get(COOKIE_MODERACAO)?.value;
  const autenticado = Boolean(senha && token && verificarToken(token, Date.now(), senha));

  if (!autenticado) {
    return (
      <div className="wrap">
        <section className="pghero">
          <div className="kicker">Área restrita</div>
          <h1>Moderação</h1>
          <p className="lede">Entre com a senha para ver a fila de reportes e fornecedores.</p>
        </section>
        <div className="pgcard estreito">
          <FormLoginModeracao />
        </div>
      </div>
    );
  }

  // Pendentes só existem para o service role (a RLS esconde do anon).
  const supabase = createServerClient();
  const { data: reportes, error } = await supabase
    .from('reportes')
    .select('id, produto, municipio, valor, criado_em')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false });

  if (error) {
    return (
      <div className="wrap">
        <section className="pghero">
          <div className="kicker">Área restrita</div>
          <h1>Moderação</h1>
        </section>
        <div className="pgcard estreito">
          <p className="pgerro">Não consegui carregar a fila — tente recarregar.</p>
        </div>
      </div>
    );
  }

  const { data: cotacoes } = await createPublicClient().from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const pendentes: ReportePendente[] = (reportes ?? []).map((r) => {
    const produto = PRODUTOS[r.produto as ProdutoTermometro];
    return {
      id: r.id as string,
      rotulo: produto?.rotulo ?? String(r.produto),
      unidade: produto?.unidade ?? '',
      valor: Number(r.valor),
      municipio: r.municipio as string,
      criadoEm: r.criado_em as string,
      mediaConab: conab.get(r.produto as string),
    };
  });

  const { data: forns } = await supabase
    .from('fornecedores')
    .select('id, nome, categoria, o_que_vende, municipio, whatsapp, status')
    .in('status', ['pendente', 'aprovado'])
    .order('criado_em', { ascending: false });

  const rotulo = new Map(CATEGORIAS.map((c) => [c.id, c.rotulo]));
  const paraModeravel = (r: Record<string, unknown>): FornecedorModeravel => ({
    id: r.id as string,
    nome: r.nome as string,
    categoriaRotulo: rotulo.get(r.categoria as never) ?? String(r.categoria),
    oQueVende: r.o_que_vende as string,
    municipio: r.municipio as string,
    whatsapp: r.whatsapp as string,
  });
  const fornecedoresPendentes = (forns ?? []).filter((r) => r.status === 'pendente').map(paraModeravel);
  const fornecedoresAprovados = (forns ?? []).filter((r) => r.status === 'aprovado').map(paraModeravel);

  return (
    <div className="wrap">
      <section className="pghero">
        <div className="kicker">Área restrita</div>
        <h1>Moderação</h1>
        <p className="lede">
        {pendentes.length === 0
          ? 'Nenhum reporte esperando decisão.'
          : `${pendentes.length} ${pendentes.length === 1 ? 'reporte esperando' : 'reportes esperando'} decisão.`}
        </p>
      </section>
      <div className="section">
        <AbasModeracao
          reportes={pendentes}
          agora={Date.now()}
          fornecedoresPendentes={fornecedoresPendentes}
          fornecedoresAprovados={fornecedoresAprovados}
        />
      </div>
    </div>
  );
}
