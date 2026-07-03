import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { montarBoletim, type Boletim } from '@/lib/boletim';

export const dynamic = 'force-dynamic';

const ALTA = '#059669';
const BAIXA = '#dc2626';

// Card 1080×1080 no subconjunto flexbox do Satori (estilos inline; todo div
// com múltiplos filhos-elemento precisa de display flex explícito).
function CardBoletim({ boletim }: { boletim: Boletim }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fffdf7',
        padding: 64,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <svg width="88" height="88" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="7" fill="#15803d" />
          <line x1="16" y1="25.5" x2="16" y2="13" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 17.5c-.7-3.6-3.5-5.6-7.2-5.6-.4 3.9 2.5 6.8 7.2 6.8z" fill="#bbf7d0" />
          <path d="M16 14.2c.7-3.6 3.5-5.6 7.2-5.6.4 3.9-2.5 6.8-7.2 6.8z" fill="#ffffff" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 52, color: '#14532d' }}>Praça Araguaia</div>
          <div style={{ fontSize: 27, color: '#525252' }}>{boletim.dataExtenso}</div>
        </div>
      </div>

      {boletim.itens.length === 0 ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#525252' }}>
          Ainda sem cotações hoje
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 20 }}>
          {boletim.itens.map((item) => (
            <div
              key={item.titulo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #e5e5e5',
                paddingBottom: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 36, color: '#171717' }}>{item.titulo}</div>
                {item.legenda && <div style={{ fontSize: 21, color: '#737373' }}>{item.legenda}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ fontSize: 42, color: '#171717' }}>{item.valorFmt}</div>
                {item.variacao && (
                  <div style={{ display: 'flex', fontSize: 29, color: item.variacao.direcao === 'alta' ? ALTA : BAIXA }}>
                    {item.variacao.direcao === 'alta' ? '▲' : '▼'} {item.variacao.texto}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, color: '#737373' }}>
        <div style={{ display: 'flex' }}>fontes: CONAB · BCB · BCE</div>
        <div style={{ display: 'flex' }}>agroapp-bay.vercel.app</div>
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
