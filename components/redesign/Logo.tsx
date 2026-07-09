// Marca da Praça Araguaia — "Ferro" (marca de gado): selo oliva, curva creme, cruz ocre.
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#586a34" />
      <path
        d="M24 12 C16 12 12 17 12 24 C12 31 16 36 24 36 C29 36 32 33.5 33.5 30"
        fill="none"
        stroke="#F1EBDE"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M24 19 L24 29 M24 24 L33 24" fill="none" stroke="#D9A85A" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
