import { Sparkline } from '@/components/Sparkline';

export type CardCotacaoProps = {
  titulo: string;
  valor: number;
  unidade: string;
  variacaoPct: number | null;
  dataReferencia: string;
  desatualizado: boolean;
  legenda?: string;
  historico?: number[];
};

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function CardCotacao({ titulo, valor, unidade, variacaoPct, dataReferencia, desatualizado, legenda, historico }: CardCotacaoProps) {
  const subiu = (variacaoPct ?? 0) >= 0;
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)] transition group-hover:border-pasto/40 group-hover:shadow-md">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{titulo}</h2>
        {variacaoPct !== null && (
          <p className={`text-sm font-semibold tabular-nums ${subiu ? 'text-emerald-600' : 'text-red-600'}`}>
            {subiu ? '▲' : '▼'} {Math.abs(variacaoPct).toLocaleString('pt-BR')}%
          </p>
        )}
      </div>
      {legenda && <p className="mt-0.5 text-xs text-tinta/40">{legenda}</p>}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{unidade}</p>
      <p className="font-sans text-4xl font-bold tabular-nums tracking-tight text-tinta">
        {fmtValor.format(valor)}
      </p>
      {historico && historico.length >= 2 && <Sparkline valores={historico} />}
      <p className="mt-4 text-xs text-tinta/40">
        {fmtData.format(new Date(dataReferencia))}
        {desatualizado && <span className="ml-2 font-semibold text-amber-600">desatualizado</span>}
      </p>
    </div>
  );
}
