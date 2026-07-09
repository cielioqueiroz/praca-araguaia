import { caminhoSparkline } from '@/lib/sparkline';
import { IconeCommodity } from './iconesCommodity';

export type CardCommodityProps = {
  tipo: string;
  titulo: string;
  unLabel: string;
  fonteLabel: string;
  valor: number;
  variacaoPct: number | null;
  historico: number[];
  dataReferencia: string;
  desatualizado: boolean;
  casas: number;
  variante: 'porteira' | 'mercado';
};

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Araguaina',
});

function brl(n: number, casas: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);
}

function partes(valor: number, casas: number) {
  const [int, frac] = brl(valor, casas).split(',');
  return { int, frac: frac ? `,${frac}` : '' };
}

// Sparkline editorial: área + linha + baseline tracejada + ponto de fechamento.
function Spark({ valores, subiu }: { valores: number[]; subiu: boolean }) {
  const L = 220;
  const A = 40;
  const pts = caminhoSparkline(valores, L, A);
  if (!pts) return <div style={{ height: 40 }} />;
  const arr = pts.split(' ');
  const [dx, dy] = arr[arr.length - 1].split(',');
  const cor = subiu ? '#6b8339' : '#a63a26';
  const grad = subiu ? 'url(#gU)' : 'url(#gD)';
  return (
    <svg className="spk" viewBox="0 0 220 52" style={{ overflow: 'visible' }}>
      <line x1="0" y1="46" x2="220" y2="46" stroke="#d9cdb2" strokeDasharray="2 3" />
      <polygon points={`${pts} 220,52 0,52`} fill={grad} />
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={dx} cy={dy} r="2.6" fill={cor} />
    </svg>
  );
}

export function CardCommodity(p: CardCommodityProps) {
  const subiu = (p.variacaoPct ?? 0) >= 0;
  const { int, frac } = partes(p.valor, p.casas);

  const delta =
    p.historico.length >= 2
      ? p.valor - p.historico[p.historico.length - 2]
      : p.variacaoPct != null
        ? p.valor - p.valor / (1 + p.variacaoPct / 100)
        : 0;

  const max = p.historico.length ? Math.max(...p.historico) : p.valor;
  const min = p.historico.length ? Math.min(...p.historico) : p.valor;

  return (
    <div className="ccard">
      <div className="head">
        <div className="id">
          <IconeCommodity tipo={p.tipo} />
          <div>
            <div className="nm">{p.titulo}</div>
            <div className="un">{p.unLabel}</div>
          </div>
        </div>
        {p.variacaoPct !== null && (
          <span className={`change ${subiu ? 'up' : 'down'}`}>
            <span className="ar">{subiu ? '▲' : '▼'}</span>
            {Math.abs(p.variacaoPct).toLocaleString('pt-BR')}%
          </span>
        )}
      </div>

      <div className="price">
        <span className="cur">R$</span>
        {int}
        <span className="frac">{frac}</span>
      </div>

      {p.variante === 'porteira' ? (
        <div className="delta">
          Variação&nbsp;&nbsp;
          <b className={delta >= 0 ? 'pos' : 'neg'}>
            {delta >= 0 ? '+' : '−'} R$ {brl(Math.abs(delta), 2)}
          </b>{' '}
          · na semana
        </div>
      ) : (
        <div className="delta">
          5D&nbsp;&nbsp;{brl(min, p.casas)} → {brl(p.valor, p.casas)}
        </div>
      )}

      <Spark valores={p.historico} subiu={subiu} />

      {p.variante === 'porteira' && (
        <div className="mm">
          <div className="cell">
            <div className="l">Máxima 30D</div>
            <div className="v">R$ {brl(max, 2)}</div>
          </div>
          <div className="cell">
            <div className="l">Mínima 30D</div>
            <div className="v">R$ {brl(min, 2)}</div>
          </div>
        </div>
      )}

      <div className="cfoot">
        <span className="src">{p.fonteLabel}</span>
        <span className={`ts ${p.desatualizado ? 'stale' : ''}`}>
          {fmtData.format(new Date(p.dataReferencia))}
          {p.desatualizado ? ' · desatualizado' : ''}
        </span>
      </div>
    </div>
  );
}
