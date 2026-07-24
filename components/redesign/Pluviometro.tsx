'use client';

import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';

// O PLUVIÔMETRO — o instrumento de vidro da porteira, com a água de verdade dentro.
//
// A primeira versão era um tubo chapado que o dono chamou de horrível, com razão.
// Este é vidro: cilindro com brilho e reflexo, um funil, a graduação gravada — e a
// água ENCHE ao carregar, com a superfície ondulando (duas ondas cruzadas), bolhas
// subindo e a chuva caindo atrás. O que ele marca é o total previsto para os 7 dias.
//
// A água sobe (scaleY 0→1 a partir do fundo, ease-out forte) porque é a entrada da
// página — vista uma vez, é onde vale um gesto. As ondas correm em laço linear
// (movimento contínuo). Tudo em transform/opacity, na GPU.
//
// SEM PISCAR: o GSAP é importado estático e a animação começa em useLayoutEffect,
// antes da primeira pintura. Sem JS, o SVG já está cheio no nível certo (o rise é só
// entrada). prefers-reduced-motion deixa a água parada no nível, sem onda nem bolha.

const VB = 200;
const TUBO = { l: 58, r: 142, top: 86, bottom: 300 }; // x-esquerda, x-direita, y-topo, y-fundo
const LARG = TUBO.r - TUBO.l; // 84
const ALT = TUBO.bottom - TUBO.top; // 214
const ESCALA_CHEIA_MM = 60; // tubo cheio = uma semana boa de águas
const WL = 42; // comprimento de onda (px)

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// A superfície ondulada, como um caminho fechado que enche para baixo. Larga o
// bastante (uma onda a mais de cada lado) para o laço de translateX não mostrar
// emenda: deslocar de 0 a -WL cai sobre um trecho idêntico.
function ondaPath(baseY: number, amp: number, fase: number): string {
  const x0 = TUBO.l - WL;
  const x1 = TUBO.r + WL;
  let d = '';
  for (let x = x0; x <= x1; x += 4) {
    const y = baseY + amp * Math.sin((2 * Math.PI * x) / WL + fase);
    d += (d === '' ? 'M' : ' L') + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} L ${x1} 330 L ${x0} 330 Z`;
}

export function Pluviometro({ totalMm, semanaSeca }: { totalMm: number; semanaSeca: boolean }) {
  const svg = useRef<SVGSVGElement>(null);

  const frac = Math.max(0, Math.min(1, totalMm / ESCALA_CHEIA_MM));
  // Um fundo mínimo visível para o instrumento não parecer quebrado num julho seco;
  // o número escrito ao lado é que dá a medida exata, e a marca dos 10 mm fica bem
  // acima deste piso, então uma semana de garoa continua lendo "pouca água".
  const alturaAgua = totalMm <= 0 ? 0 : Math.max(20, frac * ALT);
  const yAgua = TUBO.bottom - alturaAgua;

  useIso(() => {
    const raiz = svg.current;
    if (!raiz) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (alturaAgua <= 0) return;

    const ctx = gsap.context(() => {
      const agua = raiz.querySelector('[data-agua]');
      const ondas = raiz.querySelectorAll('[data-onda]');
      const bolhas = raiz.querySelectorAll<SVGCircleElement>('[data-bolha]');
      const gotas = raiz.querySelectorAll('[data-gota]');

      // A água sobe do fundo. svgOrigin no fundo do tubo para o scaleY nascer dali.
      if (agua) {
        gsap.set(agua, { transformOrigin: '50% 100%', svgOrigin: `100 ${TUBO.bottom}` });
        gsap.from(agua, { scaleY: 0, duration: 1.5, ease: 'power2.out' });
      }

      // A superfície respira: as duas ondas correm em sentidos opostos, em laço
      // linear e sem fim — movimento constante, então linear (nunca ease).
      ondas.forEach((onda, i) => {
        gsap.fromTo(
          onda,
          { x: i === 0 ? 0 : -WL },
          { x: i === 0 ? -WL : 0, duration: i === 0 ? 3.4 : 4.8, ease: 'none', repeat: -1 },
        );
      });

      // Bolhas subindo do fundo até a superfície e sumindo, em tempos diferentes.
      bolhas.forEach((b, i) => {
        const x = Number(b.getAttribute('data-x'));
        gsap.set(b, { attr: { cx: x, cy: TUBO.bottom - 6 }, opacity: 0 });
        gsap.to(b, {
          keyframes: [
            { opacity: 0.7, duration: 0.25 },
            { attr: { cy: yAgua + 6 }, opacity: 0, duration: 2.4, ease: 'sine.in' },
          ],
          repeat: -1,
          delay: i * 0.9,
          repeatDelay: 1.1,
        });
      });

      // Chuva atrás do tubo — só quando há chuva na semana.
      if (!semanaSeca) {
        gotas.forEach((g, i) => {
          gsap.set(g, { opacity: 0 });
          gsap.to(g, {
            keyframes: [
              { opacity: 0.5, y: 22, duration: 0.42, ease: 'power1.in' },
              { opacity: 0, y: 52, duration: 0.42, ease: 'power1.in' },
            ],
            repeat: -1,
            delay: i * 0.28,
            repeatDelay: 0.5,
          });
        });
      }
    }, raiz);

    return () => ctx.revert();
  }, [alturaAgua, yAgua, semanaSeca]);

  const marcas = Array.from({ length: 5 }, (_, i) => {
    const mm = (i + 1) * 10;
    return { mm, y: TUBO.bottom - (ALT * mm) / ESCALA_CHEIA_MM };
  });

  return (
    <svg
      ref={svg}
      className="pluvi"
      viewBox={`0 0 ${VB} 360`}
      role="img"
      aria-label={
        semanaSeca
          ? 'Pluviômetro quase vazio: sem chuva relevante nos próximos 7 dias'
          : `Pluviômetro marcando ${totalMm.toLocaleString('pt-BR')} milímetros previstos para os próximos 7 dias`
      }
    >
      <defs>
        {/* Vidro do cilindro: claro nas bordas, sombra suave no meio-direita. */}
        <linearGradient id="pv-vidro" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="18%" stopColor="#eef2ee" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#cdd8d4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#9fb0ac" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="pv-agua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fc0cc" />
          <stop offset="55%" stopColor="#4e8a99" />
          <stop offset="100%" stopColor="#2c5b67" />
        </linearGradient>
        <linearGradient id="pv-onda" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe0e7" />
          <stop offset="100%" stopColor="#7fb1bd" />
        </linearGradient>
        <linearGradient id="pv-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a86a" />
          <stop offset="100%" stopColor="#9c7b3e" />
        </linearGradient>
        <clipPath id="pv-tubo">
          <rect x={TUBO.l} y={TUBO.top} width={LARG} height={ALT} rx="18" />
        </clipPath>
      </defs>

      {/* Chuva atrás do tubo — nas laterais, longe do funil, para não virar sujeira
          em volta da boca. */}
      <g stroke="#8fb6c0" strokeWidth="2.4" strokeLinecap="round">
        {[
          [26, 96], [174, 88], [16, 156], [184, 168], [30, 210], [170, 220],
        ].map(([x, y], i) => (
          <line key={i} data-gota x1={x} y1={y} x2={x - 4} y2={y + 15} />
        ))}
      </g>

      {/* Sombra no chão e o pé do instrumento (um pedestal, não um palito). */}
      <ellipse cx="100" cy="336" rx="48" ry="7.5" fill="#000" opacity="0.06" />
      <rect x="96" y="300" width="8" height="18" fill="url(#pv-metal)" />
      <path d="M 74 332 L 84 318 L 116 318 L 126 332 Z" fill="url(#pv-metal)" />
      <ellipse cx="100" cy="332" rx="26" ry="4" fill="#8a6a34" />

      {/* A água, recortada pelo tubo. */}
      <g clipPath="url(#pv-tubo)">
        <g data-agua>
          <rect x={TUBO.l} y={yAgua} width={LARG} height={TUBO.bottom - yAgua + 20} fill="url(#pv-agua)" />
          {alturaAgua > 6 && (
            <>
              <g data-onda>
                <path d={ondaPath(yAgua, 3.4, 0)} fill="url(#pv-onda)" opacity="0.55" />
              </g>
              <g data-onda>
                <path d={ondaPath(yAgua, 2.4, Math.PI * 0.7)} fill="#bfe0e7" opacity="0.4" />
              </g>
              {/* Menisco: o vidro puxa a borda da água para cima. */}
              <ellipse cx="100" cy={yAgua} rx={LARG / 2 - 2} ry="3.5" fill="#d7eef2" opacity="0.7" />
            </>
          )}
        </g>

        {alturaAgua > 22 &&
          [40, 62, 96, 120, 150].map((x, i) => (
            <circle key={i} data-bolha data-x={x} r={i % 2 ? 2.4 : 1.7} fill="#eaf6f8" />
          ))}
      </g>

      {/* O vidro por cima da água: reflexo, corpo e brilho. */}
      <rect x={TUBO.l} y={TUBO.top} width={LARG} height={ALT} rx="18" fill="url(#pv-vidro)" />
      <rect x={TUBO.l} y={TUBO.top} width={LARG} height={ALT} rx="18" fill="none" stroke="#9fb4ae" strokeWidth="2" />
      {/* Faixa de luz na parede esquerda. */}
      <rect x={TUBO.l + 8} y={TUBO.top + 12} width="9" height={ALT - 30} rx="4.5" fill="#ffffff" opacity="0.5" />
      <rect x={TUBO.l + 22} y={TUBO.top + 16} width="4" height={ALT - 60} rx="2" fill="#ffffff" opacity="0.32" />

      {/* Graduação gravada. */}
      {marcas.map(({ mm, y }) => (
        <g key={mm}>
          <line x1={TUBO.r - 18} y1={y} x2={TUBO.r - 4} y2={y} stroke="#7a8f8a" strokeWidth="1.6" />
          <text x={TUBO.r - 24} y={y + 4} fontSize="11" fill="#5f726d" fontFamily="var(--mono)" textAnchor="end">
            {mm}
          </text>
        </g>
      ))}

      {/* O tubo tem uma boca de vidro no topo; o funil assenta sobre ela, sem gap. */}
      <ellipse cx="100" cy={TUBO.top} rx={LARG / 2} ry="6" fill="#e6ece9" stroke="#9fb4ae" strokeWidth="2" />

      {/* O funil: a boca que faz do tubo um pluviômetro. Desce até encaixar na boca
          do tubo (y = topo), sem flutuar. */}
      <path
        d={`M ${TUBO.l - 20} 62 L ${TUBO.l + 6} ${TUBO.top + 1} L ${TUBO.r - 6} ${TUBO.top + 1} L ${TUBO.r + 20} 62 Z`}
        fill="#f6f0e2"
        stroke="#b9a882"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="100" cy="62" rx={LARG / 2 + 20} ry="6" fill="#efe7d4" stroke="#b9a882" strokeWidth="1.8" />
      {/* Aro de brilho na boca do funil. */}
      <ellipse cx="100" cy="61" rx={LARG / 2 + 14} ry="4" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.6" />
    </svg>
  );
}
