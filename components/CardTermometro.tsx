import type { ResumoProduto } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function CardTermometro({ resumo, mediaConab }: { resumo: ResumoProduto; mediaConab?: number }) {
  const mostrarFaixa = resumo.contagem >= 2 && resumo.faixa.min !== resumo.faixa.max;
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{resumo.rotulo}</h2>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{resumo.unidade}</p>
      <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-tinta">{fmt.format(resumo.mediana)}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-tinta/50">valor típico</p>
      <p className="mt-1 text-xs text-tinta/40">
        {resumo.contagem} {resumo.contagem === 1 ? 'reporte' : 'reportes'} · últimos 7 dias
      </p>
      {mostrarFaixa && (
        <p className="mt-1 text-xs text-tinta/50">
          faixa: R$ {fmt.format(resumo.faixa.min)}–{fmt.format(resumo.faixa.max)}
        </p>
      )}
      {mediaConab !== undefined && (
        <p className="mt-1 text-xs text-tinta/50">média CONAB: {fmt.format(mediaConab)}</p>
      )}
      {resumo.municipios.length > 0 && (
        <ul className="mt-4 divide-y divide-linha/70 border-t border-linha/70">
          {resumo.municipios.map((m) => (
            <li key={m.municipio} className="flex items-baseline justify-between gap-2 py-1.5 text-sm tabular-nums">
              <span className="text-tinta/60">{m.municipio}</span>
              <span className="text-tinta/80">
                {fmt.format(m.mediana)} <span className="text-xs text-tinta/40">({m.contagem})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
