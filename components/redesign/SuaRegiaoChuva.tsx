'use client';

import { useEffect, useState } from 'react';

type Dia = { data: string; chuvaMm: number; probMax: number | null; tempMin: number; tempMax: number };
type Local = { cidade: string; uf: string; tempAtual: number | null; dias: Dia[] };

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Araguaina' });
const diaSemana = (iso: string) => fmtDia.format(new Date(`${iso}T12:00:00`)).replace('.', '');

export function SuaRegiaoChuva() {
  const [loc, setLoc] = useState<Local | null>(null);

  useEffect(() => {
    fetch('/api/chuva-local')
      .then((r) => r.json())
      .then((d: Local) => setLoc(d))
      .catch(() => {});
  }, []);

  if (!loc || loc.dias.length === 0) return null;

  const hoje = loc.dias[0];

  return (
    <section className="mt-8 grid grid-cols-1 border border-rule bg-paper sm:grid-cols-[0.9fr_1.4fr]">
      <div className="border-b border-rule p-7 sm:border-b-0 sm:border-r">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-olive">Sua região</p>
        <p className="mt-1 font-display text-2xl leading-tight text-ink">
          {loc.cidade}
          {loc.uf ? ` · ${loc.uf}` : ''}
        </p>
        {loc.tempAtual != null && (
          <p className="mt-4 font-display text-[64px] leading-none tabular-nums text-ink">{loc.tempAtual}°</p>
        )}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Hoje · {hoje.chuvaMm.toLocaleString('pt-BR')} mm
          {hoje.probMax != null ? ` · ${hoje.probMax}% de chuva` : ''}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {loc.dias.map((d, i) => {
          const larg = Math.min(100, (d.chuvaMm / 30) * 100);
          return (
            <div
              key={d.data}
              className={`flex items-center gap-3 py-2 ${i === 0 ? '' : 'border-t border-dashed border-rule'}`}
            >
              <span className="w-10 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                {i === 0 ? 'Hoje' : diaSemana(d.data)}
              </span>
              <span className="h-[6px] w-24 overflow-hidden rounded-full bg-rule/50">
                <span className="block h-full rounded-full bg-leather" style={{ width: `${larg}%` }} />
              </span>
              <span className="w-16 text-right font-sans text-sm tabular-nums text-ink">
                {d.chuvaMm.toLocaleString('pt-BR')} mm
              </span>
              <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">
                {d.probMax != null ? `${d.probMax}%` : '—'}
              </span>
              <span className="flex-1 text-right font-mono text-xs tabular-nums text-ink/70">
                {Math.round(d.tempMin)}–{Math.round(d.tempMax)}°C
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
