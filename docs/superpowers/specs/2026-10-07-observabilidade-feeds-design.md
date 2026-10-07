# Observabilidade dos feeds — 07/10/2026

## Problema

Um feed pode responder 200 e ainda assim contribuir com zero notícia para a home: os itens podem ser antigos ou fora do assunto. Hoje só uma falha de rede ou XML gera log. Não há como distinguir uma fonte útil de uma fonte viva e irrelevante.

## Decisão

Em cada atualização da home, registrar uma linha estruturada com uma entrada por feed ativo: estado da leitura e contagem de itens colhidos, recentes (até sete dias) e relevantes entre os recentes. A falha conserva o log de erro existente e aparece com contagens nulas, sem fingir que entregou zero itens.

Os números são anteriores à deduplicação e ao limite de 40 notícias; medem a contribuição potencial de cada feed, não a quantidade exibida. O log contém apenas identificador e contagens, sem título, URL de matéria ou dados do visitante. A tela e a seleção das notícias não mudam nesta fatia.

## Verificação

- Teste puro para feed com itens antigos, recentes relevantes e recentes irrelevantes.
- Teste de integração para mostrar que a medição não altera o resultado da busca e distingue falha de zero.
- Testes, typecheck, lint, build e inspeção do deployment.
