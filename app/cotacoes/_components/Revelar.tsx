'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

// Entrada suave (fade + subida) quando o bloco entra na viewport.
export function Revelar({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  // Quem pediu menos movimento no sistema recebe o conteúdo parado, e não uma
  // versão mais lenta do mesmo deslize. Sem esta guarda o bloco ainda começava em
  // opacity 0 e subia — justamente o que a preferência pede para não acontecer.
  const semMovimento = useReducedMotion();
  if (semMovimento) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
