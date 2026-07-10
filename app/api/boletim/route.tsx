import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { montarBoletim, type Boletim } from '@/lib/boletim';

export const dynamic = 'force-dynamic';

const ALTA = '#6b8339'; // musgo
const BAIXA = '#a63a26'; // tijolo

// Card 1080×1080 no subconjunto flexbox do Satori — mesma linguagem editorial da
// página (paleta terra, selo "PA", filetes, variação em musgo/tijolo).
function CardBoletim({ boletim }: { boletim: Boletim }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f1ebde',
        padding: 72,
      }}
    >
      <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, color: '#7a6f58' }}>COTAÇÕES DE REFERÊNCIA</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 92,
            height: 92,
            backgroundColor: '#3f4a24',
            border: '2px solid #b4863b',
            fontSize: 50,
            fontWeight: 700,
            color: '#f1ebde',
          }}
        >
          PA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 60, fontWeight: 700, color: '#1b1913' }}>Praça Araguaia</div>
          <div style={{ fontSize: 28, color: '#6e3e1e' }}>{boletim.dataExtenso}</div>
        </div>
      </div>

      <div style={{ display: 'flex', height: 2, backgroundColor: '#c9a86a', marginTop: 20, marginBottom: 4 }} />

      {boletim.itens.length === 0 ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#7a6f58' }}>
          Ainda sem cotações hoje
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {boletim.itens.map((item, i) => (
            <div
              key={item.titulo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 17,
                paddingBottom: 17,
                borderTop: i === 0 ? '0px solid #d9cdb2' : '1px solid #d9cdb2',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 42, fontWeight: 600, color: '#1b1913' }}>{item.titulo}</div>
                {item.legenda && <div style={{ display: 'flex', fontSize: 22, color: '#7a6f58', marginTop: 4 }}>{item.legenda}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ fontSize: 52, fontWeight: 700, color: '#1b1913' }}>{item.valorFmt}</div>
                {item.variacao && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      fontWeight: 600,
                      color: item.variacao.direcao === 'alta' ? ALTA : BAIXA,
                      border: `2px solid ${item.variacao.direcao === 'alta' ? '#b8c58f' : '#d6a99b'}`,
                      padding: '8px 14px',
                      minWidth: 128,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                      <path
                        d={item.variacao.direcao === 'alta' ? 'M12 5l8 13H4z' : 'M12 19L4 6h16z'}
                        fill={item.variacao.direcao === 'alta' ? ALTA : BAIXA}
                      />
                    </svg>
                    {item.variacao.texto}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', height: 1, backgroundColor: '#d9cdb2', marginBottom: 20 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, letterSpacing: 2, color: '#7a6f58' }}>
        <div style={{ display: 'flex' }}>FONTES · CONAB · B3 · BCB</div>
        <div style={{ display: 'flex' }}>AGROAPP-BAY.VERCEL.APP</div>
      </div>
    </div>
  );
}

export async function GET() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct');
  if (error) {
    return new Response('Erro ao carregar cotações', { status: 500 });
  }

  const boletim = montarBoletim(
    (data ?? []).map((c) => ({
      tipo: c.tipo,
      valor: Number(c.valor),
      unidade: c.unidade,
      variacao_pct: c.variacao_pct === null ? null : Number(c.variacao_pct),
    })),
  );

  return new ImageResponse(<CardBoletim boletim={boletim} />, {
    width: 1080,
    height: 1080,
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
