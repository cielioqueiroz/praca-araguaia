import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { boletimLiberado } from '@/lib/boletim-url';
import { montarBoletim, type Boletim, type ItemPorteira, type Variacao, type ReporteCidade } from '@/lib/boletim';
import { PECUARIA, PORTEIRA } from '@/lib/tipos-ui';
import { imagemDoAtivo } from '@/lib/imagens-card';
import { marcaDataUri } from '@/lib/marca';
import { programadorDataUri } from '@/lib/autor';
import { cidadesDoProduto, type ReporteAprovado } from '@/lib/termometro';
import { ehDoAraguaia } from '@/lib/praca';
import type { PrecoPraca, PrecoUf } from '@/types/cotacao';

export const dynamic = 'force-dynamic';

const ALTA = '#6b8339'; // musgo
const BAIXA = '#a63a26'; // tijolo
const TINTA = '#1b1913';
const MUTED = '#7a6f58';
const LINHA = '#d9cdb2';

// A fonte default do Satori não tem os glifos ▲/▼ — as setas são triângulos SVG.
function Seta({ direcao, tamanho = 16 }: { direcao: 'alta' | 'baixa'; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" style={{ marginRight: 5 }}>
      <path
        d={direcao === 'alta' ? 'M12 5l8 13H4z' : 'M12 19L4 6h16z'}
        fill={direcao === 'alta' ? ALTA : BAIXA}
      />
    </svg>
  );
}

function Variacao({ v, tamanho = 22 }: { v?: Variacao; tamanho?: number }) {
  if (!v) return <div style={{ display: 'flex', width: 84 }} />;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 84,
        fontSize: tamanho,
        fontWeight: 600,
        color: v.direcao === 'alta' ? ALTA : BAIXA,
      }}
    >
      <Seta direcao={v.direcao} tamanho={tamanho - 6} />
      {v.texto}
    </div>
  );
}

function Arte({ tipo, tamanho }: { tipo: string; tamanho: number }) {
  const src = imagemDoAtivo(tipo);
  if (!src) return <div style={{ display: 'flex', width: tamanho, height: tamanho }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={tamanho} height={tamanho} alt="" style={{ objectFit: 'contain' }} />;
}

// flexShrink: 0 em tudo que é bloco. Sem isso, quando o conteúdo passa da altura o
// Satori encolhe os filhos em vez de transbordar, e os textos se sobrepõem.
function Coluna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <div
        style={{ display: 'flex', flexShrink: 0, fontSize: 20, letterSpacing: 4, color: MUTED, marginBottom: 6 }}
      >
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexShrink: 0,
        fontSize: 20,
        letterSpacing: 4,
        color: MUTED,
        marginTop: 22,
        marginBottom: 6,
      }}
    >
      {titulo}
    </div>
  );
}

// Um item da porteira: a ilustração (quando existe), a unidade, o preço de CADA
// estado e o rodapé com quem apurou — CONAB fecha semana, Datagro/Scot fecham dia.
function ItemDaPorteira({ item }: { item: ItemPorteira }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Arte tipo={item.tipo} tamanho={44} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 27, fontWeight: 700, color: TINTA }}>{item.titulo}</div>
          <div style={{ display: 'flex', fontSize: 14, color: MUTED }}>{item.unidade}</div>
        </div>
      </div>

      {item.ufs.map((u, i) => (
        <div
          key={u.nome}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
            paddingBottom: 6,
            borderTop: i === 0 ? `1px solid ${LINHA}` : `1px dashed ${LINHA}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 20, color: '#3a3428' }}>{u.nome}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 25, fontWeight: 700, color: TINTA }}>{u.valorFmt}</div>
            <Variacao v={u.variacao} tamanho={17} />
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', fontSize: 13, color: MUTED, marginTop: 4 }}>{item.rodape}</div>

      {/* O que os produtores reportaram nas cidades — o dado que só existe porque
          alguém na lida digitou. Só aparece o que tem reporte. */}
      {item.cidades.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 6 }}>
          <div style={{ display: 'flex', fontSize: 13, color: '#8a7d61', marginBottom: 2 }}>
            NAS CIDADES · TERMÔMETRO
          </div>
          {item.cidades.map((c) => (
            <div
              key={c.municipio}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 5,
                paddingBottom: 5,
                borderTop: `1px dashed ${LINHA}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 18, color: '#3a3428' }}>
                {c.municipio}, {c.uf}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: TINTA }}>{c.valorFmt}</div>
                <div style={{ display: 'flex', fontSize: 13, color: MUTED, width: 70, justifyContent: 'flex-end' }}>
                  {c.contagem} {c.contagem === 1 ? 'reporte' : 'reportes'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Card no subconjunto flexbox do Satori: duas colunas — o gado (boi, vaca, novilha,
// bezerro) de um lado; a lavoura, o mercado e as cidades do outro. Cada categoria
// mostra o preço de CADA estado, nunca uma média.
function CardBoletim({ boletim }: { boletim: Boletim }) {
  const vazio = boletim.porteira.length === 0 && boletim.mercado.length === 0;
  const gado = boletim.porteira.filter((p) => PECUARIA.includes(p.tipo));
  const lavoura = boletim.porteira.filter((p) => !PECUARIA.includes(p.tipo));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1ebde',
        padding: '56px 60px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={marcaDataUri()} width={82} height={82} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 50, fontWeight: 700, color: TINTA }}>Praça Araguaia</div>
          <div style={{ fontSize: 24, color: '#6e3e1e' }}>{boletim.dataExtenso}</div>
        </div>
      </div>

      <div style={{ display: 'flex', height: 2, backgroundColor: '#c9a86a', marginTop: 16, marginBottom: 18 }} />

      {vazio ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 36, color: MUTED }}>
          Ainda sem cotações hoje
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: 34 }}>
          {/* ---------- Gado: boi, vaca, novilha e bezerro, preço de cada estado ---------- */}
          <Coluna titulo="NA PORTEIRA · GADO">
            {gado.map((item) => (
              <ItemDaPorteira key={item.tipo} item={item} />
            ))}

          </Coluna>

          <div style={{ display: 'flex', width: 1, backgroundColor: LINHA }} />

          {/* ---------- Lavoura + mercado ---------- */}
          <Coluna titulo="NA PORTEIRA · LAVOURA">
            {lavoura.map((item) => (
              <ItemDaPorteira key={item.tipo} item={item} />
            ))}

            <Secao titulo="MERCADO" />
            {boletim.mercado.map((item, i) => (
              <div
                key={item.tipo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 11,
                  paddingBottom: 11,
                  borderTop: i === 0 ? `1px solid ${LINHA}` : `1px solid ${LINHA}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Arte tipo={item.tipo} tamanho={40} />
                  <div style={{ display: 'flex', fontSize: 25, fontWeight: 600, color: TINTA }}>{item.titulo}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', fontSize: 27, fontWeight: 700, color: TINTA }}>{item.valorFmt}</div>
                  <Variacao v={item.variacao} tamanho={18} />
                </div>
              </div>
            ))}

          </Coluna>
        </div>
      )}

      {/* Sem nenhum reporte na semana, o card chama o produtor — em uma linha, não em
          30 de "sem reporte". Havendo reporte, ele aparece dentro do produto. */}
      {boletim.semReportes && (
        <div style={{ display: 'flex', fontSize: 19, color: '#6e3e1e', marginBottom: 12 }}>
          Termômetro da praça: diga por quanto estão pagando na sua cidade em
          agroapp-bay.vercel.app/termometro
        </div>
      )}

      <div style={{ display: 'flex', height: 1, backgroundColor: LINHA, marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 19, letterSpacing: 2, color: MUTED }}>
        {/* Datagro saiu na fatia 17: não é mais fonte de nada. Creditar quem não
            apurou o preço é atribuição falsa, ainda que em letra miúda. */}
        <div style={{ display: 'flex' }}>SCOT · CONAB · BCB · B3 · GOLD-API · COINGECKO</div>
        <div style={{ display: 'flex' }}>AGROAPP-BAY.VERCEL.APP</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={programadorDataUri()} width={36} height={36} alt="" />
        <div style={{ display: 'flex', fontSize: 21, color: '#6e3e1e' }}>
          Criado por Cielio Queiroz
        </div>
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  // Desenhar este card custa ~8s de função. Sem query é o card do dia, que o CDN
  // serve por 1h; com query, só assinada (ver lib/boletim-url.ts). Sem esta linha,
  // `?t=<qualquer número>` era um cache miss por chamada — um laço de curl queimava
  // a cota do plano grátis e levava o site inteiro junto.
  if (!boletimLiberado(new URL(req.url), process.env.CRON_SECRET)) {
    return new Response('nao encontrado', { status: 404 });
  }

  const supabase = createPublicClient();
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: ufs }, { data: pracas }, { data: reportes }] = await Promise.all([
    supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct'),
    supabase.from('cotacoes_uf').select('tipo, uf, valor, unidade, variacao_pct, data_referencia'),
    supabase.from('cotacoes_praca').select('tipo, praca, uf, valor, unidade, variacao_pct, data_referencia'),
    supabase
      .from('reportes')
      .select('produto, municipio, valor')
      .eq('status', 'aprovado')
      .gte('criado_em', seteDias),
  ]);
  if (error) {
    return new Response('Erro ao carregar cotações', { status: 500 });
  }

  // As cidades de CADA produto da porteira (antes: só do boi).
  const aprovados = ((reportes ?? []) as ReporteAprovado[]).map((r) => ({
    produto: r.produto,
    municipio: r.municipio,
    valor: Number(r.valor),
  }));
  const cidades: ReporteCidade[] = PORTEIRA.flatMap((produto) =>
    cidadesDoProduto(aprovados, produto).map((c) => ({ produto, ...c })),
  );

  // O card é imagem de tamanho fixo: com os sete estados, a porteira passaria de 45
  // linhas e estouraria (ele já virou 1080x1350 quando eram 12). Ele mostra a CASA —
  // BA/MA/PE são referência do site, não da foto do dia.
  const precosUf: PrecoUf[] = (ufs ?? [])
    .filter((u) => ehDoAraguaia(u.uf as string))
    .map((u) => ({
      tipo: u.tipo as string,
      uf: u.uf as string,
      valor: Number(u.valor),
      unidade: u.unidade as string,
      variacaoPct: u.variacao_pct === null ? null : Number(u.variacao_pct),
      dataReferencia: u.data_referencia as string,
    }));

  // Boi e vaca vêm por praça e agora são UMA linha por estado — cabem inteiros, com
  // Bahia e Maranhão no fim, igual ao site. (Os produtos por UF acima seguem só a
  // casa: soja/milho por estado ainda somariam muitas linhas.)
  const precosPraca: PrecoPraca[] = (pracas ?? [])
    .map((p) => ({
      tipo: p.tipo as string,
      praca: p.praca as string,
      uf: p.uf as string,
      valor: Number(p.valor),
      unidade: p.unidade as string,
      variacaoPct: p.variacao_pct === null ? null : Number(p.variacao_pct),
      dataReferencia: p.data_referencia as string,
    }));

  const boletim = montarBoletim(
    (data ?? []).map((c) => ({
      tipo: c.tipo,
      valor: Number(c.valor),
      unidade: c.unidade,
      variacao_pct: c.variacao_pct === null ? null : Number(c.variacao_pct),
    })),
    precosUf,
    cidades,
    new Date(),
    precosPraca,
  );

  // Retrato alto: 6 categorias na porteira, 7 de mercado e as cidades do Termômetro.
  //
  // A altura é MEDIDA no render, não calculada: o Satori não rola nem corta — o que
  // não cabe escreve por cima do rodapé. Em 1800 (medida de quando boi e vaca tinham
  // 4 estados) o Bezerro colidia com a linha do Termômetro, porque a fatia 17 trocou
  // esses 8 estados por 14 praças. Se a porteira crescer de novo, refaça a medida:
  // renderize e olhe o pé da coluna da esquerda.
  return new ImageResponse(<CardBoletim boletim={boletim} />, {
    width: 1080,
    height: 1960,
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
