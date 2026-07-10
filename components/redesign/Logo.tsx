// Marca da Praça Araguaia — monograma serifado "PA" em selo quadrado (traço afiado).
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill="#586a34" />
      <rect x="4" y="4" width="40" height="40" fill="none" stroke="#b4863b" strokeWidth="1.1" />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="#f1ebde"
        style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
      >
        PA
      </text>
    </svg>
  );
}
