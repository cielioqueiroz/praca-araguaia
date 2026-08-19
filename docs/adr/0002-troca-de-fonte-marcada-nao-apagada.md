# Quando a fonte de uma série muda, a série é marcada — não cortada

**Status:** aceito (18/08/2026)

O histórico do boi guarda CONAB (média de estados, semanal) até 10/07/2026 e Scot (praças, diária) a partir de 15/07/2026, na mesma linha do gráfico. A vaca tem a mesma emenda entre Datagro e Scot. São ~1% de diferença de nível — pequeno demais para gritar, grande o bastante para um degrau de fonte ser lido como movimento de mercado.

Decidimos **manter a série inteira e marcar a troca no gráfico**, com uma linha vertical na data e a legenda dizendo quem publicou cada trecho. Cortar seria mais limpo de argumentar, mas jogaria fora um ano de backfill da CONAB e deixaria o boi com semanas de história em vez de um ano — justamente o gancho de retorno do produto.

Isso **não** contradiz o que fizemos com a novilha (migração 0009) e com o ouro (0005), onde os pontos antigos foram apagados: lá a unidade mudou (arroba → cabeça, onça → grama) e a série desenharia um salto de +900% ou −96,8% que nunca existiu. Aqui a unidade é a mesma (R$/@) e o recorte é parecido — a série continua verdadeira, só muda quem apurou.

**A regra que fica:** unidade diferente ou produto diferente → apaga; mesmo produto e mesma unidade com outro apurador → marca. Quem adicionar uma troca de fonte registra a data em `lib/trocas-de-fonte.ts`, e o gráfico se encarrega do resto.
