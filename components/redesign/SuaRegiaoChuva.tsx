'use client';

import { useEffect, useState } from 'react';

type Dia = { data: string; chuvaMm: number; probMax: number | null; tempMin: number; tempMax: number };
type Local = { cidade: string; uf: string; tempAtual: number | null; dias: Dia[] };

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Araguaina' });
const diaSemana = (iso: string) => fmtDia.format(new Date(`${iso}T12:00:00`)).replace('.', '');

export function SuaRegiaoChuva() {
  const [loc, setLoc] = useState<Local | null>(null);

  useEffect(() => {
    const porIP = () =>
      fetch('/api/chuva-local')
        .then((r) => r.json())
        .then((d: Local) => setLoc(d))
        .catch(() => {});

    if (!navigator.geolocation) {
      porIP();
      return;
    }
    // Tenta a localização exata (em tempo real) primeiro; cai pro IP se negar.
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const [geo, met] = await Promise.all([
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
            ).then((r) => r.json()),
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                '&current=temperature_2m&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
                '&timezone=auto&forecast_days=7',
            ).then((r) => r.json()),
          ]);
          const d = met.daily;
          const dias: Dia[] = (d?.time ?? []).map((data: string, i: number) => ({
            data,
            chuvaMm: Number(d.precipitation_sum?.[i] ?? 0),
            probMax: d.precipitation_probability_max?.[i] ?? null,
            tempMin: Number(d.temperature_2m_min?.[i]),
            tempMax: Number(d.temperature_2m_max?.[i]),
          }));
          setLoc({
            cidade: geo.city || geo.locality || geo.principalSubdivision || 'Sua região',
            uf: String(geo.principalSubdivisionCode || '').split('-').pop() || '',
            tempAtual: typeof met?.current?.temperature_2m === 'number' ? Math.round(met.current.temperature_2m) : null,
            dias,
          });
        } catch {
          porIP();
        }
      },
      () => porIP(),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  if (!loc || loc.dias.length === 0) return null;

  const hoje = loc.dias[0];

  return (
    <section className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-rule bg-paper shadow-[0_1px_2px_rgba(28,38,32,0.04)] sm:grid-cols-[0.9fr_1.4fr]">
      <div className="border-b border-rule p-7 sm:border-b-0 sm:border-r">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agua">Sua região</p>
        <p className="mt-1 flex items-baseline gap-2 font-display text-2xl leading-tight text-ink">
          {loc.cidade}
          {loc.uf && (
            <span className="rounded-md bg-paper-warm px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted">
              {loc.uf}
            </span>
          )}
        </p>
        {loc.tempAtual != null && (
          <p className="mt-4 font-sans text-[64px] font-bold leading-none tabular-nums tracking-tight text-ink">
            {loc.tempAtual}°
          </p>
        )}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Chuva hoje {hoje.chuvaMm.toLocaleString('pt-BR')} mm
          {hoje.probMax != null ? `, ${hoje.probMax}% de probabilidade` : ''}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {loc.dias.map((d, i) => {
          const forte = d.chuvaMm >= 10;
          const chove = d.chuvaMm >= 0.1;
          const larg = Math.max(chove ? 7 : 0, Math.min(100, (d.chuvaMm / 30) * 100));
          return (
            <div
              key={d.data}
              className={`flex items-center gap-3 py-2.5 ${i === 0 ? '' : 'border-t border-dashed border-rule/50'}`}
            >
              <span className="w-10 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                {i === 0 ? 'Hoje' : diaSemana(d.data)}
              </span>
              <span className="h-2.5 w-24 overflow-hidden rounded-full bg-[#e7decd]">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${larg}%`,
                    background: forte ? 'linear-gradient(90deg,#5c93a0,#2f5b66)' : 'linear-gradient(90deg,#9fbdc6,#5b8b97)',
                  }}
                />
              </span>
              <span
                className={`w-16 text-right font-sans text-sm tabular-nums ${forte ? 'font-semibold text-agua' : chove ? 'text-agua/90' : 'text-ink2/45'}`}
              >
                {d.chuvaMm.toLocaleString('pt-BR')} mm
              </span>
              <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">
                {d.probMax != null ? `${d.probMax}%` : ''}
              </span>
              <span className="flex-1 text-right font-mono text-xs tabular-nums text-ink/60">
                {Math.round(d.tempMin)}°/{Math.round(d.tempMax)}°
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
