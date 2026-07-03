import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const CHUVA_FORTE_MM = 10;
// Teto visual da barra de mm (30 mm+ = barra cheia).
const BARRA_MAX_MM = 30;

export function CardChuva({ previsao }: { previsao: PrevisaoMunicipio }) {
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">
        {previsao.municipio} · {previsao.uf}
      </h2>
      <ul className="mt-3 divide-y divide-linha/70">
        {previsao.dias.map((dia) => (
          <li key={dia.data} className="flex items-center gap-3 py-2 text-sm tabular-nums">
            <span className="w-10 shrink-0 capitalize text-tinta/50">
              {fmtDia.format(new Date(`${dia.data}T12:00:00Z`))}
            </span>
            <span
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-linha"
              aria-hidden="true"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-rio"
                style={{ width: `${Math.min(100, (dia.chuvaMm / BARRA_MAX_MM) * 100)}%` }}
              />
            </span>
            <span className={`w-16 shrink-0 text-right ${dia.chuvaMm >= CHUVA_FORTE_MM ? 'font-semibold text-rio' : 'text-tinta/80'}`}>
              {dia.chuvaMm.toLocaleString('pt-BR')} mm
            </span>
            <span className="w-9 shrink-0 text-right text-tinta/50">
              {dia.probMax === null ? '—' : `${dia.probMax}%`}
            </span>
            <span className="w-16 shrink-0 text-right whitespace-nowrap text-tinta/50">
              {Math.round(dia.tempMin)}–{Math.round(dia.tempMax)}°C
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
