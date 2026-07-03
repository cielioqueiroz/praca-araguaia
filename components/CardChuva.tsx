import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const CHUVA_FORTE_MM = 10;

export function CardChuva({ previsao }: { previsao: PrevisaoMunicipio }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        {previsao.municipio} · {previsao.uf}
      </h2>
      <ul className="mt-3 divide-y divide-neutral-100">
        {previsao.dias.map((dia) => (
          <li key={dia.data} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="w-10 capitalize text-neutral-500">
              {fmtDia.format(new Date(`${dia.data}T12:00:00Z`))}
            </span>
            <span className={dia.chuvaMm >= CHUVA_FORTE_MM ? 'font-semibold text-sky-700' : 'text-neutral-700'}>
              {dia.chuvaMm.toLocaleString('pt-BR')} mm
            </span>
            <span className="text-neutral-500">{dia.probMax === null ? '—' : `${dia.probMax}%`}</span>
            <span className="text-neutral-500">
              {Math.round(dia.tempMin)}–{Math.round(dia.tempMax)}°C
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
