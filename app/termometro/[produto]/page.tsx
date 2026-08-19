import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { resumirReportes, PRODUTOS, ORDEM_PRODUTOS, type ProdutoTermometro, type OrigemReporte } from '@/lib/termometro';
import { historicoTermometro, type ReporteHistorico } from '@/lib/termometro-historico';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params;
  const info = PRODUTOS[produto as ProdutoTermometro];
  // A marca entra pelo template do layout: 'Praça Araguaia — Boi no Termômetro'.
  if (!info) return { title: 'Termômetro da Praça' };
  return {
    title: `${info.rotulo} no Termômetro`,
    description: `O que produtores da região do Araguaia relataram estar recebendo por ${info.rotulo.toLowerCase()} (${info.unidade}) — valor típico, faixa e a tendência dos últimos 90 dias.`,
  };
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
    .select('valor, municipio, criado_em, origem')
    .eq('produto', produto)
    .gte('criado_em', desde);

  const { data: cotacoes } = await supabase.from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  // O card do topo espelha o de 7 dias que o usuário clicou no /termometro (o CardTermometro
  // rotula "últimos 7 dias"); o gráfico abaixo usa a janela completa de 90 dias.
  const corte7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const linhas7d = (reportes ?? [])
    .filter((x) => new Date(x.criado_em as string).getTime() >= corte7d)
    .map((x) => ({
      produto,
      municipio: x.municipio as string,
      valor: Number(x.valor),
      origem: (x.origem ?? 'produtor') as OrigemReporte,
    }));
  const resumo = resumirReportes(linhas7d)[0]; // 1 produto -> 0 ou 1 resumo

  const pontos = historicoTermometro(
    (reportes ?? []).map((x): ReporteHistorico => ({ valor: Number(x.valor), criado_em: x.criado_em as string })),
  );

  return (
    <div className="wrap">
      <Link href="/termometro" className="pgvolta">
        ← Termômetro da Praça
      </Link>

      <section className="pghero">
        <div className="kicker">No Termômetro</div>
        <h1>{info.rotulo}</h1>
        <p className="lede">
          O que produtores da região relataram receber por {info.rotulo.toLowerCase()} — e como isso se moveu.
        </p>
        <div className="pgmeta mono">{info.unidade} · reportes conferidos antes de entrar na conta</div>
      </section>

      {resumo ? (
        <section className="section">
          <div className="section-head">
            <div className="t">Agora</div>
            <div className="line" />
            <div className="meta">
              Valor típico<span className="pill">7 dias</span>
            </div>
          </div>
          <div className="pggrade" style={{ gridTemplateColumns: 'minmax(280px, 420px)' }}>
            <div>
              <CardTermometro resumo={resumo} mediaConab={conab.get(produto)} />
            </div>
          </div>
        </section>
      ) : (
        <div className="pgvazio">
          <h2>Ninguém reportou {info.rotulo.toLowerCase()} nos últimos 7 dias</h2>
          <p>
            Se você negociou, <Link href={`/termometro/reportar?produto=${produto}`}>diga por quanto</Link> — é
            anônimo e leva um minuto.
          </p>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <div className="t">Tendência</div>
          <div className="line" />
          <div className="meta">
            Mediana por dia<span className="pill">até 90 dias</span>
          </div>
        </div>
        <div className="pgcard">
          {pontos.length === 0 ? (
            <p className="cidnota" style={{ marginTop: 0 }}>
              Ainda não há reportes suficientes para desenhar uma linha.
            </p>
          ) : (
            <GraficoCotacao pontos={pontos} titulo={info.rotulo} unidade={info.unidade} />
          )}
        </div>
      </section>

      <ConviteDistribuicao
        alvo="termometro"
        titulo={['Você vendeu esta', 'semana? Conta aí.']}
        linha="Um minuto seu vira o preço que o vizinho consulta antes de fechar negócio. É anônimo."
      />
    </div>
  );
}
