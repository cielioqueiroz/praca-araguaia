export type CardCotacaoProps = {
  titulo: string;
  valor: number;
  unidade: string;
  variacaoPct: number | null;
  dataReferencia: string;
  desatualizado: boolean;
  legenda?: string;
};

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function CardCotacao({ titulo, valor, unidade, variacaoPct, dataReferencia, desatualizado, legenda }: CardCotacaoProps) {
  const subiu = (variacaoPct ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{titulo}</h2>
      {legenda && <p className="mt-0.5 text-xs text-neutral-400">{legenda}</p>}
      <p className="mt-2 text-4xl font-bold text-neutral-900">
        {unidade} {fmtValor.format(valor)}
      </p>
      {variacaoPct !== null && (
        <p className={`mt-1 text-sm font-medium ${subiu ? 'text-emerald-600' : 'text-red-600'}`}>
          {subiu ? '▲' : '▼'} {Math.abs(variacaoPct).toLocaleString('pt-BR')}%
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        {fmtData.format(new Date(dataReferencia))}
        {desatualizado && <span className="ml-2 font-semibold text-amber-600">desatualizado</span>}
      </p>
    </div>
  );
}
