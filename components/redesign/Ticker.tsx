'use client';

import { useEffect, useState } from 'react';
import type { TickerItem } from '@/lib/ticker';

// Preços reais das cotações gravadas (/api/ticker, cache de 5 min). Enquanto não
// chegam, a faixa fica vazia — melhor nada do que número inventado.
export function Ticker() {
  const [itens, setItens] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch('/api/ticker')
      .then((r) => r.json())
      .then((d: { itens?: TickerItem[] }) => setItens(d.itens ?? []))
      .catch(() => {});
  }, []);

  if (itens.length === 0) return <div className="ticker-strip" aria-hidden="true" />;

  const dobrado = [...itens, ...itens];
  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">
        {dobrado.map((it, i) => (
          <span key={i}>
            <b>{it.rotulo}</b> {it.valor}{' '}
            <span className={it.dir}>
              {it.dir === 'up' ? '▲' : '▼'}
              {it.pct}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
