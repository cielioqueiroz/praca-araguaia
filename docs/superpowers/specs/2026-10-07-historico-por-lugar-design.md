# Histórico por praça e UF — 07/10/2026

## Problema

O gráfico da porteira em `/cotacao/[tipo]` usa `cotacoes_historico`, que contém um valor regional agregado. O produtor escolhe uma praça ou um estado para vender, e a linha regional não mostra a tendência desse lugar.

## Decisão

Guardar pontos de cada lugar em `cotacoes_lugar_historico`, com tipo, recorte (`praca` ou `uf`), UF, nome da praça quando houver, valor, unidade, fonte e data de referência. A chave do ponto é tipo + recorte + UF + praça + data; recoleta do mesmo fechamento é idempotente. A migração registra como primeiro ponto as linhas atuais de `cotacoes_praca` e `cotacoes_uf`, com a data verdadeira delas.

A coleta diária passa a inserir os pontos por lugar depois de atualizar o retrato atual. A página de cotação da porteira apresenta um seletor explícito do lugar e desenha somente sua série; os ativos do Mercado continuam com o gráfico anterior. Sem dois pontos, a tela informa que o histórico desse lugar começou agora, sem inventar tendência. A Scot só expõe o fechamento atual, então não se reconstruirão datas anteriores de praça.

A CONAB fornece sua série semanal por UF. Um backfill autenticado preenche até 90 dias de boi, soja e milho por UF, com os valores e datas do próprio arquivo. O gráfico de boi e vaca usa praça; o de soja, milho, novilha e bezerro usa UF.

## Limites

- Nenhuma média aparece como preço local.
- A praça de referência mantém o nome e a UF, sem ser apresentada como cidade do visitante.
- Erro de gravação do histórico local deixa erro na coleta para que o fechamento não trate a execução como completa.
- Banco anterior não recebe nova migration; o corte atual é Neon e o retorno temporário exige manter o comportamento antigo até migrar esse esquema.
