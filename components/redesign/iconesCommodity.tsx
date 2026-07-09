import type { ReactNode } from 'react';

const props = {
  className: 'ic',
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONES: Record<string, ReactNode> = {
  boi: (
    <svg {...props}>
      <path d="M6 11c-1.5-3 0-6 2.5-6 1.8 0 3 1.2 3.5 3" />
      <path d="M26 11c1.5-3 0-6-2.5-6-1.8 0-3 1.2-3.5 3" />
      <path d="M8 12c0-3 3.5-5 8-5s8 2 8 5v3c0 4-3.5 7-8 7s-8-3-8-7z" />
      <circle cx="13" cy="14" r=".9" fill="currentColor" />
      <circle cx="19" cy="14" r=".9" fill="currentColor" />
      <path d="M14 18c.7.6 1.3.8 2 .8s1.3-.2 2-.8" />
      <path d="M11 22v4M21 22v4M15 24v3M17 24v3" />
    </svg>
  ),
  soja: (
    <svg {...props}>
      <path d="M6 22c0-8 6-14 14-14 3 0 6 1 6 1s0 3-2 6" />
      <path d="M25 15c-4 8-11 12-19 12 0 0 0-3 2-6" />
      <circle cx="12" cy="20" r="2.4" />
      <circle cx="17" cy="16" r="2.4" />
      <circle cx="21" cy="12" r="2.4" />
    </svg>
  ),
  milho: (
    <svg {...props}>
      <path d="M16 4c-4 2-6 6-6 12 0 5 2 9 6 12 4-3 6-7 6-12 0-6-2-10-6-12z" />
      <path d="M10 8c-3 1-5 2-6 4 2 1 4 1 6 0" />
      <path d="M22 8c3 1 5 2 6 4-2 1-4 1-6 0" />
      <path d="M13 12c1 1 2 1 3 1s2 0 3-1" />
      <path d="M13 17c1 1 2 1 3 1s2 0 3-1" />
      <path d="M13 22c1 1 2 1 3 1s2 0 3-1" />
    </svg>
  ),
  dolar: (
    <svg {...props}>
      <path d="M20 10c-1.5-1.5-4-2-6-2-3 0-5 1.5-5 4s2 3.5 5 4 5 1.5 5 4-2 4-5 4c-2 0-4.5-.5-6-2" />
      <path d="M14 5v22" />
    </svg>
  ),
  euro: (
    <svg {...props}>
      <path d="M22 8c-2-1.5-4-2-7-2-5 0-9 4-9 10s4 10 9 10c3 0 5-.5 7-2" />
      <path d="M4 13h12M4 17h12" />
    </svg>
  ),
  ouro: (
    <svg {...props}>
      <path d="M8 10l4-6h8l4 6-8 18z" />
      <path d="M8 10h16M12 4l4 6 4-6M12 10l4 18M20 10l-4 18" />
    </svg>
  ),
};

export function IconeCommodity({ tipo }: { tipo: string }) {
  return ICONES[tipo] ?? ICONES.boi;
}
