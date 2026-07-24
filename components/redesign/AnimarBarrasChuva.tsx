'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// As barras de chuva crescendo em sequência — a "chuva chegando" nas colunas.
//
// Envolve o conteúdo já renderizado (faixa da semana e cards dos municípios) e
// anima o que estiver marcado com `data-barra`. É anime.js aqui, e não CSS, por
// causa do `stagger` com origem: a sequência parte do primeiro dia e corre para o
// sétimo, e cada barra tem a sua própria altura de destino, vinda da variável
// --alt. Fazer isso em CSS exigiria um keyframe por barra.
//
// TRÊS CUIDADOS:
//
// 1. O TAMANHO FINAL JÁ ESTÁ NO HTML DO SERVIDOR (a variável --alt, aplicada pelo
//    CSS). Sem JS, as barras aparecem prontas — a animação é entrada, não
//    conteúdo. E o número em milímetros ao lado NUNCA é animado: é dado.
// 2. Só anima quando entra na tela, e uma vez por barra. A página tem 5 cards de
//    7 dias; animar os 35 de uma vez, fora de vista, seria trabalho jogado fora.
// 3. `prefers-reduced-motion` desliga tudo e não toca em nada — o estado do
//    servidor já é o final.

export function AnimarBarrasChuva({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const no = raiz.current;
    if (!no) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let vivo = true;
    const observados = new Set<Element>();
    let observador: IntersectionObserver | undefined;

    // Import dinâmico: o anime.js só desce nesta rota, depois da primeira pintura.
    import('animejs').then(({ animate, stagger }) => {
      if (!vivo) return;

      // O EIXO VEM DECLARADO NO HTML, e não é adivinhado.
      //
      // A faixa da semana tem colunas que crescem para CIMA (scaleY, origem no pé);
      // as linhas dos cards têm barras que crescem para a DIREITA (scaleX, origem
      // à esquerda). Animar tudo em scaleY, como a primeira versão fazia, achatava
      // a barra horizontal do card na vertical durante a entrada — o traço sumia e
      // reaparecia esticando na altura, que não é o gesto da chuva enchendo.
      const animarEixo = (grupo: Element, eixo: 'x' | 'y') => {
        const barras = grupo.querySelectorAll<HTMLElement>(`[data-barra="${eixo}"]`);
        if (barras.length === 0) return;

        animate(barras, {
          // De zero até o tamanho que o CSS já calculou para cada uma.
          ...(eixo === 'y' ? { scaleY: [0, 1] } : { scaleX: [0, 1] }),
          opacity: [0, 1],
          duration: 700,
          delay: stagger(55),
          ease: 'outExpo',
        });
      };

      const animarGrupo = (grupo: Element) => {
        animarEixo(grupo, 'y');
        animarEixo(grupo, 'x');
      };

      observador = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting || observados.has(e.target)) continue;
            observados.add(e.target);
            observador?.unobserve(e.target);
            animarGrupo(e.target);
          }
        },
        { rootMargin: '0px 0px -10% 0px' },
      );

      for (const grupo of no.querySelectorAll('[data-grupo-barras]')) {
        observador.observe(grupo);
      }
    });

    return () => {
      vivo = false;
      observador?.disconnect();
    };
  }, []);

  return <div ref={raiz}>{children}</div>;
}
