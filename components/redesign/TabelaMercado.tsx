import Link from 'next/link';
import { caminhoSparkline } from '@/lib/sparkline';
import { IconeCommodity } from './iconesCommodity';

export type ItemMercado = {
  tipo: string;
  titulo: string;
  valor: number;
  casas: number;
  unLabel: string; // 'por grama', 'comercial', 'por unidade'
  variacaoPct: number | null;
  historico: number[];
  /** false = não é dinheiro (o Ibovespa é ponto): sai o R$, entra o 'pts'. */
  moeda?: boolean;
};

function brl(n: number, casas: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
}

// Sparkline mínima: só a linha. Sem área, sem baseline — a tabela é o assunto.
function Linha({ valores, subiu }: { valores: number[]; subiu: boolean }) {
  const pts = caminhoSparkline(valores, 88, 22);
  if (!pts) return <svg className="mspk" viewBox="0 0 88 26" />;
  return (
    <svg className="mspk" viewBox="0 0 88 26" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={subiu ? '#6b8339' : '#a63a26'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Câmbio, ouro e cripto: uma linha por ativo. Antes eram 5 cards grandes com foto,
// selo e etiqueta — informação de mercado não precisa desse peso.
export function TabelaMercado({ itens }: { itens: ItemMercado[] }) {
  return (
    <div className="mtable">
      <div className="mrow h">
        <span>Ativo</span>
        <span>Valor</span>
        <span>Variação</span>
        <span>30 dias</span>
      </div>

      {itens.map((i) => {
        const subiu = (i.variacaoPct ?? 0) >= 0;
        return (
          <Link key={i.tipo} className="mrow" href={`/cotacao/${i.tipo}`}>
            <span className="ativo">
              <IconeCommodity tipo={i.tipo} className="mic" />
              <b>{i.titulo}</b>
              <i>{i.unLabel}</i>
            </span>
            {/* O Ibovespa é PONTO, não real: prefixar R$ nele seria mentira. */}
            <span className="valor tnum">
              {i.moeda === false ? null : <em>R$</em>}
              {brl(i.valor, i.casas)}
              {i.moeda === false && <em style={{ marginLeft: 6 }}>pts</em>}
            </span>
            {i.variacaoPct === null ? (
              <span className="var-vazia">—</span>
            ) : i.variacaoPct === 0 ? (
              // Preço parado: traço neutro. Seta verde em 0% afirmava alta que não houve.
              <span className="var flat"><span className="ar">–</span>0%</span>
            ) : (
              <span className={`var ${subiu ? 'up' : 'down'}`}>
                <span className="ar">{subiu ? '▲' : '▼'}</span>
                {Math.abs(i.variacaoPct).toLocaleString('pt-BR')}%
              </span>
            )}
            <Linha valores={i.historico} subiu={subiu} />
          </Link>
        );
      })}
    </div>
  );
}
