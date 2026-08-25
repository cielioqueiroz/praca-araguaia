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

  // A trilha desliza -50% e recomeça. Para a emenda não aparecer, a metade que sai
  // tem de ser idêntica à que entra — daí repetir um número PAR de vezes.
  //
  // Quatro, e não duas: com duas, uma tela larga (ou poucas cotações no ar) deixava a
  // trilha mais curta que a faixa e abria um vão no fim. Quatro cópias cobrem qualquer
  // largura, e repetir preço é o que o pregão faz mesmo — a informação não muda.
  const repetido = [...itens, ...itens, ...itens, ...itens];

  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">
        {repetido.map((it, i) => (
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
