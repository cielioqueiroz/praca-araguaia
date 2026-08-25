'use client';

import { useEffect, useRef, useState } from 'react';

// O RESULTADO que conta até o total.
//
// Numa calculadora, ver o número correr até o resultado é o gesto certo — é a
// máquina "totalizando", como a fita da registradora. Isto NÃO fere a regra do
// projeto de "nunca animar o valor de um preço": lá o número é uma cotação
// publicada, e mostrar um valor intermediário mentiria sobre o mercado. Aqui o
// número é a conta que o próprio produtor está fazendo com o que digitou — não há
// verdade externa sendo contrariada, e o valor final é sempre exato.
//
// Como não trai o resultado:
//   - parte do valor ATUAL na tela (um ref), não do zero: digitar de novo faz o
//     número perseguir o novo total em vez de recomeçar do nada;
//   - crava o valor exato no fim (onComplete), nunca deixa o último frame do tween
//     virar o resultado;
//   - prefers-reduced-motion entra direto no valor, sem contagem.

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ValorContado({ valor, testId }: { valor: number; testId?: string }) {
  const [texto, setTexto] = useState(() => fmt.format(valor));
  const atual = useRef(valor);
  const anim = useRef<{ pause: () => void } | null>(null);

  useEffect(() => {
    if (atual.current === valor) return;

    const querParado =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (querParado) {
      atual.current = valor;
      setTexto(fmt.format(valor));
      return;
    }

    let vivo = true;
    // Import dinâmico: o anime.js só desce quando um resultado muda de verdade.
    import('animejs').then(({ animate }) => {
      if (!vivo) return;
      anim.current?.pause();
      const de = { n: atual.current };
      anim.current = animate(de, {
        n: valor,
        duration: 420,
        ease: 'outExpo',
        onUpdate: () => {
          atual.current = de.n;
          setTexto(fmt.format(de.n));
        },
        onComplete: () => {
          atual.current = valor;
          setTexto(fmt.format(valor)); // o resultado exato, não o último frame
        },
      });
    });

    return () => {
      vivo = false;
      anim.current?.pause();
    };
  }, [valor]);

  return (
    <span data-testid={testId} className="font-sans text-2xl font-bold tabular-nums text-mata">
      R$ {texto}
    </span>
  );
}
