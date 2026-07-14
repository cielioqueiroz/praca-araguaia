'use client';

import { useEffect, useState } from 'react';
import { CardChuva } from '@/components/CardChuva';

type Dia = { data: string; chuvaMm: number; probMax: number | null; tempMin: number; tempMax: number };
type Local = { cidade: string; uf: string; tempAtual: number | null; dias: Dia[] };

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

  // É o MESMO card das cidades da praça — só com a etiqueta "Sua região" e a
  // temperatura de agora. Antes, esta lista era uma segunda implementação dos 7 dias,
  // e por isso ficou para trás quando os cards ganharam ícone e traço no dia seco.
  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2">
      <CardChuva
        previsao={{ municipio: loc.cidade, uf: loc.uf, dias: loc.dias }}
        etiqueta="Sua região"
        tempAtual={loc.tempAtual}
      />
    </section>
  );
}
