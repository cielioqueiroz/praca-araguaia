'use client';

import { useEffect, useState } from 'react';
import { Ticker } from './Ticker';

type Loc = { cidade: string; uf: string; temp: number | null; lat?: number; lon?: number; exata?: boolean };

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Araguaina',
});

export function UtilityBar() {
  const [loc, setLoc] = useState<Loc | null>(null);

  useEffect(() => {
    // Mostra algo na hora: preferência salva, senão IP (sem pop-up).
    const salvo = localStorage.getItem('praca-loc');
    if (salvo) {
      try {
        setLoc(JSON.parse(salvo) as Loc);
      } catch {
        /* ignora */
      }
    } else {
      fetch('/api/geo')
        .then((r) => r.json())
        .then((d: Loc) => setLoc((cur) => (cur?.exata ? cur : d)))
        .catch(() => {});
    }
    // E pede a localização exata (em tempo real) automaticamente.
    pedirExata();
  }, []);

  function pedirExata() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const [geo, met] = await Promise.all([
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
            ).then((r) => r.json()),
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`,
            ).then((r) => r.json()),
          ]);
          const novo: Loc = {
            cidade: geo.city || geo.locality || geo.principalSubdivision || 'Sua região',
            uf: String(geo.principalSubdivisionCode || '').split('-').pop() || '',
            temp: typeof met?.current?.temperature_2m === 'number' ? Math.round(met.current.temperature_2m) : null,
            lat: latitude,
            lon: longitude,
            exata: true,
          };
          setLoc(novo);
          localStorage.setItem('praca-loc', JSON.stringify(novo));
        } catch {
          /* mantém o que tem */
        }
      },
      () => {
        /* permissão negada: segue com o IP */
      },
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }

  const texto = loc
    ? `${loc.cidade}${loc.uf ? ` · ${loc.uf}` : ''}${loc.temp != null ? ` · ${loc.temp}°C` : ''}`
    : 'Detectando região…';

  return (
    <div className="utility">
      <div className="left">
        <span className="dot" />
        <span>Pregão aberto · B3</span>
        <span className="sep">·</span>
        <button className="loc" type="button" onClick={pedirExata} title="Atualizar minha localização exata">
          <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {texto}
        </button>
        <span className="sep">·</span>
        <span>{fmtData.format(new Date())}</span>
      </div>
      <Ticker />
    </div>
  );
}
