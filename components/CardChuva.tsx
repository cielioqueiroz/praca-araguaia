import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const diaCurto = (iso: string) => fmtDia.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');
const CHUVA_FORTE_MM = 10;
const BARRA_MAX_MM = 30; // teto visual da barra

export function CardChuva({ previsao }: { previsao: PrevisaoMunicipio }) {
  return (
    <div className="group rounded-2xl border border-rule bg-paper p-5 shadow-[0_1px_2px_rgba(28,38,32,0.04)] transition duration-200 hover:-translate-y-1 hover:border-rule-strong hover:shadow-[0_18px_40px_-24px_rgba(38,48,26,0.35)]">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink2/70">{previsao.municipio}</h2>
        <span className="rounded-md bg-paper-warm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {previsao.uf}
        </span>
      </div>

      <ul className="mt-3">
        {previsao.dias.map((dia, i) => {
          const forte = dia.chuvaMm >= CHUVA_FORTE_MM;
          const chove = dia.chuvaMm >= 0.1;
          const larg = Math.max(chove ? 7 : 0, Math.min(100, (dia.chuvaMm / BARRA_MAX_MM) * 100));
          return (
            <li
              key={dia.data}
              className={`flex items-center gap-3 py-2.5 text-sm tabular-nums ${i > 0 ? 'border-t border-dashed border-rule/50' : ''}`}
            >
              <span className="w-9 shrink-0 font-mono text-[11px] uppercase text-muted">{diaCurto(dia.data)}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#e7decd]" aria-hidden="true">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                  style={{
                    width: `${larg}%`,
                    background: forte ? 'linear-gradient(90deg,#5c93a0,#2f5b66)' : 'linear-gradient(90deg,#9fbdc6,#5b8b97)',
                  }}
                />
              </span>
              <span
                className={`w-14 shrink-0 text-right font-sans ${forte ? 'font-semibold text-agua' : chove ? 'text-agua/90' : 'text-ink2/45'}`}
              >
                {dia.chuvaMm.toLocaleString('pt-BR')} mm
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-xs text-muted">
                {dia.probMax === null ? '' : `${dia.probMax}%`}
              </span>
              <span className="w-14 shrink-0 whitespace-nowrap text-right font-mono text-xs text-ink/55">
                {Math.round(dia.tempMin)}°/{Math.round(dia.tempMax)}°
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
