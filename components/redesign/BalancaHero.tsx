'use client';

import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';

// A BALANÇA do hero da calculadora — a mesma craft do pluviômetro da chuva.
//
// Pesa o que se vende contra o que ele vale: de um lado a saca de grão, do outro o
// real. Ao carregar, uma MOEDA cai no prato do real, o braço pende para o lado dela
// e assenta no nível — o gesto de "quanto vale o seu", contado em uma cena. É GSAP:
// a moeda cai (ease-in, como cai algo pesado), o braço tomba e volta com uma curva
// de mola (elastic.out). Vista uma vez, no carregamento, é onde um gesto vale.
//
// Sem JS, o SVG já está no nível, com a moeda no prato — a animação é só a entrada.
// prefers-reduced-motion deixa tudo parado.

const FULCRO = { x: 100, y: 66 }; // o ponto onde o braço gira

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function BalancaHero() {
  const svg = useRef<SVGSVGElement>(null);

  useIso(() => {
    const raiz = svg.current;
    if (!raiz) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const braco = raiz.querySelector('[data-braco]');
      const moeda = raiz.querySelector('[data-moeda]');
      const tl = gsap.timeline();

      if (moeda) {
        tl.from(moeda, { y: -64, opacity: 0, duration: 0.5, ease: 'power2.in' });
      }
      if (braco) {
        gsap.set(braco, { svgOrigin: `${FULCRO.x} ${FULCRO.y}` });
        tl.to(braco, { rotation: 4.5, duration: 0.24, ease: 'power2.out' }, '>-0.04')
          .to(braco, { rotation: 0, duration: 1.2, ease: 'elastic.out(1, 0.4)' });
      }
    }, raiz);

    return () => ctx.revert();
  }, []);

  return (
    <svg className="cbalanca" viewBox="0 0 200 200" role="img" aria-label="Balança de dois pratos">
      <defs>
        <linearGradient id="cb-latao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8b978" />
          <stop offset="50%" stopColor="#c9a86a" />
          <stop offset="100%" stopColor="#916f36" />
        </linearGradient>
        <linearGradient id="cb-ouro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d089" />
          <stop offset="100%" stopColor="#c39a4e" />
        </linearGradient>
        <linearGradient id="cb-madeira" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a4a24" />
          <stop offset="100%" stopColor="#5a3418" />
        </linearGradient>
      </defs>

      {/* Sombra, base torneada e coluna — o que não se mexe. */}
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="#000" opacity="0.07" />
      <path d="M 70 184 L 78 168 L 122 168 L 130 184 Z" fill="url(#cb-madeira)" />
      <rect x="84" y="160" width="32" height="10" rx="3" fill="url(#cb-madeira)" />
      <rect x="94" y="66" width="12" height="96" rx="4" fill="url(#cb-latao)" />
      <circle cx="100" cy="66" r="7" fill="#6e3e1e" />
      <circle cx="100" cy="66" r="3" fill="#c9a86a" />

      {/* O braço e os dois pratos giram juntos, em torno do fulcro. */}
      <g data-braco>
        <rect x="34" y="62" width="132" height="8" rx="4" fill="url(#cb-latao)" />
        <circle cx="38" cy="66" r="3.5" fill="#6e3e1e" />
        <circle cx="162" cy="66" r="3.5" fill="#6e3e1e" />

        {/* Prato esquerdo: a saca de grão (o que se vende). */}
        <g>
          <line x1="38" y1="68" x2="24" y2="104" stroke="#a98a4e" strokeWidth="1.5" />
          <line x1="38" y1="68" x2="52" y2="104" stroke="#a98a4e" strokeWidth="1.5" />
          <path d="M 18 104 Q 38 120 58 104 Z" fill="#e6dcc2" stroke="#b9a882" strokeWidth="1.6" />
          <ellipse cx="38" cy="104" rx="20" ry="4" fill="#efe7d2" />
          {/* saca */}
          <path d="M 31 103 Q 28 90 38 88 Q 48 90 45 103 Z" fill="#c8a86e" stroke="#9c7b3e" strokeWidth="1.2" />
          <path d="M 33 90 L 43 90" stroke="#7a5a2c" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        {/* Prato direito: o real, com a moeda que cai. */}
        <g>
          <line x1="162" y1="68" x2="148" y2="104" stroke="#a98a4e" strokeWidth="1.5" />
          <line x1="162" y1="68" x2="176" y2="104" stroke="#a98a4e" strokeWidth="1.5" />
          <path d="M 142 104 Q 162 120 182 104 Z" fill="#e6dcc2" stroke="#b9a882" strokeWidth="1.6" />
          <ellipse cx="162" cy="104" rx="20" ry="4" fill="#efe7d2" />
          <g data-moeda>
            <circle cx="162" cy="97" r="11" fill="url(#cb-ouro)" stroke="#9c7b3e" strokeWidth="1.4" />
            <text x="162" y="101.5" fontSize="11" fontWeight="700" fill="#6e3e1e" textAnchor="middle" fontFamily="var(--serif)">
              R$
            </text>
          </g>
        </g>
      </g>
    </svg>
  );
}
