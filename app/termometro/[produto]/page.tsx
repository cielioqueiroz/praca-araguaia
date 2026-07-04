import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { resumirReportes, PRODUTOS, ORDEM_PRODUTOS, type ProdutoTermometro } from '@/lib/termometro';
import { historicoTermometro, type ReporteHistorico } from '@/lib/termometro-historico';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params;
  const info = PRODUTOS[produto as ProdutoTermometro];
  return { title: info ? `${info.rotulo} — Termômetro da Praça` : 'Termômetro da Praça' };
}

export default async function HistoricoProduto({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params;
  if (!ORDEM_PRODUTOS.includes(produto as ProdutoTermometro)) notFound();
  const info = PRODUTOS[produto as ProdutoTermometro];

  const supabase = createPublicClient();
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  // A RLS entrega só aprovados para o client anon.
  const { data: reportes } = await supabase
    .from('reportes')
    .select('valor, municipio, criado_em')
    .eq('produto', produto)
    .gte('criado_em', desde);

  const { data: cotacoes } = await supabase.from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const linhas = (reportes ?? []).map((x) => ({
    produto,
    municipio: x.municipio as string,
    valor: Number(x.valor),
  }));
  const resumo = resumirReportes(linhas)[0]; // 1 produto -> 0 ou 1 resumo

  const pontos = historicoTermometro(
    (reportes ?? []).map((x): ReporteHistorico => ({ valor: Number(x.valor), criado_em: x.criado_em as string })),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/termometro" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-mata">{info.rotulo}</h1>

      {resumo && (
        <div className="mt-6 max-w-sm">
          <CardTermometro resumo={resumo} mediaConab={conab.get(produto)} />
        </div>
      )}

      <section className="mt-10">
        <div className="border-b border-linha pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Tendência</h2>
        </div>
        <div className="mt-4">
          {pontos.length === 0 ? (
            <p className="text-tinta/50">Sem histórico ainda.</p>
          ) : (
            <GraficoCotacao pontos={pontos} titulo={info.rotulo} unidade={info.unidade} />
          )}
        </div>
      </section>
    </main>
  );
}
