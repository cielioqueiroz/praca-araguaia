'use client';

import { useEffect, useRef } from 'react';

// A BALANÇA do hero — o instrumento de quem pesa o que vende.
//
// A calculadora é a conta da porteira: peso, arroba, saca, cabeça, tudo vira real.
// A balança de dois pratos é o desenho disso, e ela FECHA o fiel ao carregar: o
// braço oscila e assenta no nível, o gesto de quem acabou de pesar o lote. É GSAP
// porque é uma sequência no tempo (oscila, volta, assenta) com uma curva de mola —
// um settle que um keyframe de CSS não dá com a mesma naturalidade.
//
// Só o BRAÇO gira (os pratos giram junto, como numa balança de verdade que ainda
// balança); o fiel e a base ficam parados. Sem JS, o SVG já está no nível — a
// animação é entrada, não conteúdo. prefers-reduced-motion deixa tudo parado.

export function BalancaHero() {
  const braco = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = braco.current;
    if (!g) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let vivo = true;
    let matar: (() => void) | undefined;

    import('gsap').then(({ gsap }) => {
      if (!vivo) return;
      // Gira em torno do fiel (o centro do braço, no topo da coluna).
      gsap.set(g, { transformOrigin: '100px 92px' });
      const tl = gsap.timeline();
      tl.from(g, { rotation: -9, duration: 0.5, ease: 'power2.out' })
        .to(g, { rotation: 5, duration: 0.7, ease: 'sine.inOut' })
        .to(g, { rotation: 0, duration: 1.1, ease: 'elastic.out(1, 0.4)' });
      matar = () => tl.kill();
    });

    return () => {
      vivo = false;
      matar?.();
    };
  }, []);

  return (
    <svg className="cbalanca" viewBox="0 0 200 200" role="img" aria-label="Balança de dois pratos">
      <defs>
        <linearGradient id="cb-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a86a" />
          <stop offset="100%" stopColor="#9c7b3e" />
        </linearGradient>
      </defs>

      {/* Base e coluna — o que não se mexe. */}
      <ellipse cx="100" cy="182" rx="52" ry="9" fill="#d9cdb2" />
      <rect x="94" y="92" width="12" height="88" rx="4" fill="url(#cb-metal)" />
      <circle cx="100" cy="92" r="8" fill="#6e3e1e" />

      {/* O braço e os dois pratos giram juntos. */}
      <g ref={braco}>
        <rect x="30" y="88" width="140" height="7" rx="3.5" fill="url(#cb-metal)" />
        <circle cx="34" cy="91.5" r="4" fill="#6e3e1e" />
        <circle cx="166" cy="91.5" r="4" fill="#6e3e1e" />

        {/* Prato esquerdo: o gado. */}
        <g>
          <line x1="34" y1="92" x2="18" y2="126" stroke="#b9a882" strokeWidth="1.6" />
          <line x1="34" y1="92" x2="50" y2="126" stroke="#b9a882" strokeWidth="1.6" />
          <path d="M12 126 Q34 144 56 126 Z" fill="#eadfc4" stroke="#b9a882" strokeWidth="1.6" />
        </g>

        {/* Prato direito: o real. */}
        <g>
          <line x1="166" y1="92" x2="150" y2="126" stroke="#b9a882" strokeWidth="1.6" />
          <line x1="166" y1="92" x2="182" y2="126" stroke="#b9a882" strokeWidth="1.6" />
          <path d="M144 126 Q166 144 188 126 Z" fill="#eadfc4" stroke="#b9a882" strokeWidth="1.6" />
          <text x="166" y="122" fontSize="22" fontWeight="700" fill="#3f4a24" textAnchor="middle" fontFamily="var(--serif)">
            R$
          </text>
        </g>
      </g>
    </svg>
  );
}
