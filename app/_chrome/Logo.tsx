import { MARCA } from '@/lib/marca';

// Marca da Praça Araguaia — "Broto no sulco": a folha nasce da terra lavrada.
// O grupo .vt-folha balança de leve (globals.css); `parado` desliga o vento, e ele
// também some sozinho em prefers-reduced-motion.
export function Logo({
  size = 44,
  className,
  parado = false,
}: {
  size?: number;
  className?: string;
  parado?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`${parado ? '' : 'vt '}${className ?? ''}`.trim() || undefined}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="24" fill={MARCA.bone} />
      <circle cx="24" cy="24" r="23" fill="none" stroke={MARCA.olive} strokeWidth="1.2" />
      <g className="vt-folha" style={{ transformOrigin: '24px 34px' }}>
        <path d="M24 34c0-9 3-14 11-16 1 10-4 15-11 16z" fill={MARCA.musgo} />
        <path d="M24 34c0-7-3-11-9-12 0 8 3 11 9 12z" fill={MARCA.olive} />
        <path d="M24 34V19" stroke={MARCA.olive} strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M8 36c9 3 23 3 32-1" fill="none" stroke={MARCA.couro} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M11 41c8 2 19 2 26-1"
        fill="none"
        stroke={MARCA.couro}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
