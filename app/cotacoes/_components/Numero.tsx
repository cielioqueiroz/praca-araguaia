import type { CSSProperties } from 'react';

// O número que ASSENTA no quadro.
//
// A peça de movimento do painel: cada preço sobe uma fração de linha e ganha nitidez
// ao entrar, escalonado de cima para baixo — o quadro da praça se preenchendo, linha
// por linha, como um painel mecânico virando. A variação ao lado e a linha de 30 dias
// completam a cena: a seta chega pelo lado para onde aponta, e a sparkline se desenha
// da esquerda para a direita, que é a direção do tempo que ela mostra.
//
// POR QUE NÃO É UMA CONTAGEM. A primeira versão fazia o número VIAJAR do preço de
// ontem até o de hoje: a distância percorrida seria a variação do dia. Bonito, e
// errado. Medido no navegador em 23/07/2026, a arroba de Goiás saía assim:
//
//     316,50 → 313,49 → 315,15 → 315,78 → 316,24 → … → 316,50
//
// O 316,50 do início é o HTML do servidor; o 313,49 aparece quando a hidratação
// começa a animação. Ou seja: durante um instante — mais longo quanto pior o
// celular e a conexão, que é a régua de quem lê isto no pasto — a tela mostrava
// 313,49 como se fosse o preço. Um número plausível, no lugar do preço, é uma
// mentira; e este projeto não mente sobre número (é a mesma regra do "preço zero é
// mentira, ausência é verdade" das fontes).
//
// Então o movimento entrou no LUGAR do número, não no valor dele. Nada aqui exibe
// nunca um preço que não seja o preço. E, sem JS, sai CSS puro: sem cliente, sem
// hidratação, sem risco — a animação é só a entrada, e `prefers-reduced-motion`
// desliga tudo num lugar só (globals.css).

type NumeroProps = {
  valor: number;
  casas: number;
  /** Índice da linha: escalona a entrada de cima para baixo. */
  atraso?: number;
  className?: string;
};

export function Numero({ valor, casas, atraso = 0, className }: NumeroProps) {
  const texto = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);

  // A classe de quem chama traz o tabular-nums: sem largura fixa de dígito a linha
  // treme quando o valor troca.
  return (
    <span
      className={className ? `${className} assenta` : 'assenta'}
      style={{ '--atraso': `${atraso}s` } as CSSProperties}
    >
      {texto}
    </span>
  );
}
