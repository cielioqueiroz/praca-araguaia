'use client';

import { useEffect, useState } from 'react';

// Mostra de onde o usuário está acessando (a localização já detectada no topo).
export function LocalUsuario() {
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    const usar = (cidade?: string, uf?: string) => {
      if (cidade) setTexto(`Você está acessando de ${cidade}${uf ? `, ${uf}` : ''}`);
    };
    const salvo = localStorage.getItem('praca-loc');
    if (salvo) {
      try {
        const s = JSON.parse(salvo);
        usar(s.cidade, s.uf);
        return;
      } catch {
        /* ignora */
      }
    }
    fetch('/api/geo')
      .then((r) => r.json())
      .then((d) => usar(d.cidade, d.uf))
      .catch(() => {});
  }, []);

  if (!texto) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      <svg className="h-3 w-3 stroke-agua" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      {texto}
    </span>
  );
}
