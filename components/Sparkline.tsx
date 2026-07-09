import { caminhoSparkline } from '@/lib/sparkline';

const LARGURA = 100;
const ALTURA = 32;

export function Sparkline({ valores }: { valores: number[] }) {
  const pontos = caminhoSparkline(valores, LARGURA, ALTURA);
  if (!pontos) return null;
  const subiu = valores[valores.length - 1] >= valores[0];
  const cor = subiu ? '#059669' : '#dc2626'; // emerald-600 / red-600 — mesma semântica da seta
  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      width="100%"
      height={ALTURA}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-3 block"
    >
      <polyline
        points={pontos}
        fill="none"
        stroke={cor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
