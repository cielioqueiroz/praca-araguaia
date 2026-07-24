'use client';

import { useEffect, useRef } from 'react';

// O PLUVIÔMETRO — a tese da página de chuva.
//
// O instrumento da chuva no campo é o pluviômetro do mourão da cerca. É ele que o
// produtor olha para saber quanto caiu. Então a página abre com um, e o que ele
// marca é o total previsto para os 7 dias na região.
//
// A CENA MUDA COM A ESTAÇÃO, e é isso que a torna honesta: em julho, no seco do
// Araguaia, o tubo fica vazio e a página diz "sem chuva à vista" — que é
// exatamente o que o produtor precisa saber. Quando as águas chegam, o tubo enche
// e a chuva cai atrás. Não é enfeite: é o dado tomando forma.
//
// ESCALA. O tubo cheio = 60 mm na semana, que é uma semana boa de águas na região.
// Acima disso a água encosta no topo e o número escrito manda — o tubo satura, mas
// não mente: quem lê 82 mm vê 82 mm.
//
// GSAP faz a orquestração: a água sobe, a superfície ondula e as gotas caem em
// sequência. É um trecho com várias partes dependentes no tempo, que é onde a
// timeline dele ganha de um punhado de animações soltas.

const ESCALA_CHEIA_MM = 60;

// Coordenadas do tubo dentro do viewBox — a água se move entre elas.
const TUBO = { x: 60, largura: 76, topo: 78, base: 300 };

type PluviometroProps = {
  totalMm: number;
  /** Nenhum município tem chuva em nenhum dos 7 dias. */
  semanaSeca: boolean;
};

export function Pluviometro({ totalMm, semanaSeca }: PluviometroProps) {
  const raiz = useRef<SVGSVGElement>(null);
  const fracao = Math.max(0, Math.min(1, totalMm / ESCALA_CHEIA_MM));
  const alturaCheia = TUBO.base - TUBO.topo;
  const alturaAgua = alturaCheia * fracao;
  const yAgua = TUBO.base - alturaAgua;

  useEffect(() => {
    const svg = raiz.current;
    if (!svg) return;

    // Preferência do sistema tem a palavra final: sem movimento, o desenho já está
    // no estado final (o SVG é renderizado cheio no servidor) e nada roda.
    const querParado = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (querParado.matches) return;

    let vivo = true;
    let matar: (() => void) | undefined;

    // Import dinâmico: o GSAP só é baixado nesta rota, e só depois da página
    // pintar. Nenhum byte dele pesa na home nem no painel de cotações.
    import('gsap').then(({ gsap }) => {
      if (!vivo) return;

      const agua = svg.querySelector('[data-agua]');
      const onda = svg.querySelector('[data-onda]');
      const gotas = svg.querySelectorAll('[data-gota]');
      if (!agua) return;

      const linha = gsap.timeline();

      // A água sobe do fundo até a marca. `attr` porque o nível é a geometria do
      // retângulo (y/height), não um transform — assim a superfície acompanha.
      linha.fromTo(
        [agua, onda].filter(Boolean),
        { attr: { y: TUBO.base }, opacity: 0 },
        {
          attr: { y: (i: number) => (i === 0 ? yAgua : yAgua - 3) },
          opacity: 1,
          duration: 1.4,
          ease: 'power3.out',
        },
      );
      linha.fromTo(agua, { attr: { height: 0 } }, { attr: { height: alturaAgua }, duration: 1.4, ease: 'power3.out' }, 0);

      // A superfície respira. Só quando há água: ondular um tubo vazio seria
      // desenhar chuva que não existe.
      if (onda && alturaAgua > 4) {
        linha.to(onda, { attr: { rx: 30 }, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }, '>-0.2');
      }

      // A chuva atrás do tubo, em sequência. Na semana seca não cai gota nenhuma.
      if (gotas.length > 0 && !semanaSeca) {
        gsap.set(gotas, { opacity: 0 });
        gsap.to(gotas, {
          keyframes: [
            { opacity: 0.55, y: 26, duration: 0.5, ease: 'power1.in' },
            { opacity: 0, y: 62, duration: 0.5, ease: 'power1.in' },
          ],
          stagger: { each: 0.22, repeat: -1, repeatDelay: 0.5 },
        });
      }

      matar = () => {
        linha.kill();
        gsap.killTweensOf(gotas);
        if (onda) gsap.killTweensOf(onda);
      };
    });

    return () => {
      vivo = false;
      matar?.();
    };
  }, [alturaAgua, yAgua, semanaSeca]);

  // A graduação, de 10 em 10 mm. Vai até 50 e não até 60: a marca do topo cai
  // exatamente na boca do funil, e o número ficava por cima do desenho.
  const marcas = Array.from({ length: 5 }, (_, i) => {
    const mm = (i + 1) * 10;
    return { mm, y: TUBO.base - (alturaCheia * mm) / ESCALA_CHEIA_MM };
  });

  return (
    <svg
      ref={raiz}
      className="pluvi"
      viewBox="0 0 200 360"
      role="img"
      aria-label={
        semanaSeca
          ? 'Pluviômetro vazio: nenhuma chuva prevista para os próximos 7 dias'
          : `Pluviômetro marcando ${totalMm.toLocaleString('pt-BR')} milímetros previstos para os próximos 7 dias`
      }
    >
      <defs>
        <clipPath id="pluvi-tubo">
          <rect x={TUBO.x} y={TUBO.topo} width={TUBO.largura} height={TUBO.base - TUBO.topo} rx="12" />
        </clipPath>
        <linearGradient id="pluvi-agua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fa9b4" />
          <stop offset="100%" stopColor="#2f5b66" />
        </linearGradient>
      </defs>

      {/* A chuva cai ATRÁS do tubo. */}
      <g stroke="#7fa9b4" strokeWidth="2.5" strokeLinecap="round" opacity="0">
        {[
          [26, 40], [166, 58], [40, 92], [178, 104], [16, 132], [156, 150],
        ].map(([x, y], i) => (
          <line key={i} data-gota x1={x} y1={y} x2={x - 5} y2={y + 17} />
        ))}
      </g>

      {/* O tubo: parede, água, graduação. */}
      <rect
        x={TUBO.x}
        y={TUBO.topo}
        width={TUBO.largura}
        height={TUBO.base - TUBO.topo}
        rx="12"
        fill="#efe7d6"
        stroke="#b9a882"
        strokeWidth="2"
      />

      <g clipPath="url(#pluvi-tubo)">
        <rect data-agua x={TUBO.x} y={yAgua} width={TUBO.largura} height={alturaAgua} fill="url(#pluvi-agua)" />
        {alturaAgua > 4 && (
          <ellipse data-onda cx={TUBO.x + TUBO.largura / 2} cy={yAgua} rx="42" ry="5" fill="#9fbdc6" opacity="0.9" />
        )}
      </g>

      {marcas.map(({ mm, y }) => (
        <g key={mm}>
          <line x1={TUBO.x + TUBO.largura - 20} y1={y} x2={TUBO.x + TUBO.largura} y2={y} stroke="#b9a882" strokeWidth="1.5" />
          <text x={TUBO.x + TUBO.largura + 9} y={y + 4} fontSize="11" fill="#7a6f58" fontFamily="var(--mono)">
            {mm}
          </text>
        </g>
      ))}

      {/* A boca do funil, que é o que faz um tubo virar pluviômetro. */}
      <path
        d={`M${TUBO.x - 17} 78 L${TUBO.x + 4} 52 L${TUBO.x + TUBO.largura - 4} 52 L${TUBO.x + TUBO.largura + 17} 78 Z`}
        fill="#f6f0e2"
        stroke="#b9a882"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* O mourão: é de cerca que o instrumento vive. */}
      <rect x={TUBO.x + TUBO.largura / 2 - 5} y={TUBO.base} width="10" height="42" fill="#6e3e1e" opacity="0.55" />
      <line x1="34" y1="342" x2="166" y2="342" stroke="#b9a882" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
