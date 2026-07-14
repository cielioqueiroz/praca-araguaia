import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { montarBoletim, type Boletim, type ItemPorteira, type Variacao, type ReporteCidade } from '@/lib/boletim';
import { PECUARIA } from '@/lib/tipos-ui';
import { imagemDoAtivo } from '@/lib/imagens-card';
import { marcaDataUri } from '@/lib/marca';
import { programadorDataUri } from '@/lib/autor';
import { MUNICIPIOS } from '@/lib/fontes/chuva';
import { mediana } from '@/lib/termometro';
import type { PrecoUf } from '@/types/cotacao';

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

            {/* Boi nas cidades da praça — o dado que só existe porque o produtor reporta.
                Fica junto do gado: é boi, e equilibra a altura das duas colunas. */}
            {boletim.cidades.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 8 }}>
                <div style={{ display: 'flex', fontSize: 20, letterSpacing: 4, color: MUTED }}>
                  BOI NAS CIDADES
                </div>
                <div style={{ display: 'flex', fontSize: 15, color: MUTED, marginTop: 3, marginBottom: 4 }}>
                  Termômetro · reportes de produtores
                </div>
                {boletim.cidades.map((c, i) => (
                  <div
                    key={c.municipio}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 7,
                      paddingBottom: 7,
                      borderTop: i === 0 ? `1px solid ${LINHA}` : `1px dashed ${LINHA}`,
                    }}
                  >
                    <div style={{ display: 'flex', fontSize: 20, color: '#3a3428' }}>
                      {c.municipio}, {c.uf}
                    </div>
                    {c.valorFmt === null ? (
                      <div style={{ display: 'flex', fontSize: 16, color: '#b9a882' }}>sem reporte</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: TINTA }}>{c.valorFmt}</div>
                        <div style={{ display: 'flex', fontSize: 15, color: MUTED, width: 78, justifyContent: 'flex-end' }}>
                          {c.contagem} {c.contagem === 1 ? 'reporte' : 'reportes'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

      <div style={{ display: 'flex', height: 1, backgroundColor: LINHA, marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 19, letterSpacing: 2, color: MUTED }}>
        <div style={{ display: 'flex' }}>CONAB · DATAGRO · SCOT · BCB · GOLD-API · COINGECKO</div>
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

export async function GET() {
  const supabase = createPublicClient();
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: ufs }, { data: reportes }] = await Promise.all([
    supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct'),
    supabase.from('cotacoes_uf').select('tipo, uf, valor, unidade, variacao_pct, data_referencia'),
    supabase
      .from('reportes')
      .select('municipio, valor')
      .eq('status', 'aprovado')
      .eq('produto', 'boi')
      .gte('criado_em', seteDias),
  ]);
  if (error) {
    return new Response('Erro ao carregar cotações', { status: 500 });
  }

  const valoresPorCidade = new Map<string, number[]>();
  for (const r of (reportes ?? []) as { municipio: string; valor: number }[]) {
    const arr = valoresPorCidade.get(r.municipio) ?? [];
    arr.push(Number(r.valor));
    valoresPorCidade.set(r.municipio, arr);
  }
  const cidades: ReporteCidade[] = MUNICIPIOS.map((m) => {
    const valores = valoresPorCidade.get(m.nome) ?? [];
    return {
      municipio: m.nome,
      uf: m.uf,
      mediana: valores.length ? mediana(valores) : null,
      contagem: valores.length,
    };
  });

  const precosUf: PrecoUf[] = (ufs ?? []).map((u) => ({
    tipo: u.tipo as string,
    uf: u.uf as string,
    valor: Number(u.valor),
    unidade: u.unidade as string,
    variacaoPct: u.variacao_pct === null ? null : Number(u.variacao_pct),
    dataReferencia: u.data_referencia as string,
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
  );

  // Retrato alto: são 6 categorias na porteira (24 linhas de estado), 6 de mercado
  // e as 5 cidades. Medido no render: abaixo de 1800 a coluna do gado invade o rodapé.
  return new ImageResponse(<CardBoletim boletim={boletim} />, {
    width: 1080,
    height: 1800,
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
