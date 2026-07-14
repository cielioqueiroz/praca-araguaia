import type { IconType } from 'react-icons';
import { LuSun, LuCloudSun, LuCloudDrizzle, LuCloudRain, LuCloudRainWind } from 'react-icons/lu';
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const diaCurto = (iso: string) => fmtDia.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');

const CHUVA_FORTE_MM = 10;
const CHUVA_MIN_MM = 0.1; // abaixo disso o dia é seco
const BARRA_MAX_MM = 30; // teto visual da barra

// O ícone conta a mesma história que o número: seco, ameaça, garoa, chuva, aguaceiro.
function iconeDoDia(chuvaMm: number, probMax: number | null): { Icone: IconType; rotulo: string } {
  if (chuvaMm >= CHUVA_FORTE_MM) return { Icone: LuCloudRainWind, rotulo: 'chuva forte' };
  if (chuvaMm >= 2) return { Icone: LuCloudRain, rotulo: 'chuva' };
  if (chuvaMm >= CHUVA_MIN_MM) return { Icone: LuCloudDrizzle, rotulo: 'garoa' };
  if ((probMax ?? 0) >= 30) return { Icone: LuCloudSun, rotulo: 'pode chover' };
  return { Icone: LuSun, rotulo: 'sem chuva' };
}

// `etiqueta` e `tempAtual` só existem no card da região do usuário — que fora isso é
// exatamente este card, para as linhas dos 7 dias serem lidas do mesmo jeito em todos.
export function CardChuva({
  previsao,
  etiqueta,
  tempAtual,
}: {
  previsao: PrevisaoMunicipio;
  etiqueta?: string;
  tempAtual?: number | null;
}) {
  return (
    <div className="group rounded-2xl border border-rule bg-paper p-5 shadow-[0_1px_2px_rgba(28,38,32,0.04)] transition duration-200 hover:-translate-y-1 hover:border-rule-strong hover:shadow-[0_18px_40px_-24px_rgba(38,48,26,0.35)]">
      {etiqueta && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-agua">{etiqueta}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink2/70">{previsao.municipio}</h2>
        <div className="flex items-center gap-2">
          {tempAtual != null && (
            <span className="font-sans text-lg font-bold tabular-nums leading-none text-ink">{tempAtual}°</span>
          )}
          {previsao.uf && (
            <span className="rounded-md bg-paper-warm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {previsao.uf}
            </span>
          )}
        </div>
      </div>

      <ul className="mt-3">
        {previsao.dias.map((dia, i) => {
          const forte = dia.chuvaMm >= CHUVA_FORTE_MM;
          const chove = dia.chuvaMm >= CHUVA_MIN_MM;
          const larg = Math.max(chove ? 7 : 0, Math.min(100, (dia.chuvaMm / BARRA_MAX_MM) * 100));
          const { Icone, rotulo } = iconeDoDia(dia.chuvaMm, dia.probMax);
          const temProb = dia.probMax !== null && dia.probMax > 0;

          return (
            <li
              key={dia.data}
              // Grid de colunas fixas: os 7 dias (e as cidades entre si) ficam alinhados.
              className={`grid grid-cols-[2.25rem_1rem_1fr_3.5rem_2.5rem_3.5rem] items-center gap-x-2.5 py-2.5 text-sm tabular-nums ${
                i > 0 ? 'border-t border-dashed border-rule/50' : ''
              }`}
            >
              <span className="font-mono text-[11px] uppercase text-muted">{diaCurto(dia.data)}</span>

              <Icone role="img" aria-label={rotulo} className={`h-4 w-4 ${chove ? 'text-agua' : 'text-muted/70'}`} />

              <span className="relative h-2.5 overflow-hidden rounded-full bg-[#e7decd]" aria-hidden="true">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                  style={{
                    width: `${larg}%`,
                    background: forte ? 'linear-gradient(90deg,#5c93a0,#2f5b66)' : 'linear-gradient(90deg,#9fbdc6,#5b8b97)',
                  }}
                />
              </span>

              {/* Dia seco não repete "0 mm" e "0%": vira traço, e o olho vai direto no que chove. */}
              <span
                className={`text-right font-sans ${
                  forte ? 'font-semibold text-agua' : chove ? 'font-medium text-agua/90' : 'text-ink2/40'
                }`}
              >
                {chove ? `${dia.chuvaMm.toLocaleString('pt-BR')} mm` : '—'}
              </span>

              <span className={`text-right font-mono text-xs ${temProb ? 'text-agua/80' : 'text-ink2/40'}`}>
                {temProb ? `${dia.probMax}%` : '—'}
              </span>

              <span className="whitespace-nowrap text-right font-mono text-xs text-ink/55">
                {Math.round(dia.tempMin)}°/{Math.round(dia.tempMax)}°
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
