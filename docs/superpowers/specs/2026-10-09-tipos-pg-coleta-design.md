# Tipos do PostgreSQL na coleta SQL

## Problema

O driver `pg` entrega `numeric` como texto e `timestamptz` como `Date`. O novo
repositório SQL tipou esses campos como números e textos sem convertê-los. A lógica
pura usa comparação estrita do valor e comparação da data ISO; assim, um preço
repetido pode parecer mudança e reiniciar o “estável desde”, ou perder a variação
preservada na recoleta do mesmo fechamento.

## Decisão

- Converter os valores e datas de consulta na fronteira do repositório SQL.
- Manter as funções puras e o contrato dos repositórios com `number` e data ISO.
- Aplicar a mesma conversão às consultas de histórico e aos IDs de assinantes.
  Um ID fora do intervalo seguro de inteiros falha, em vez de virar outro chat.
- Não alterar as cotações existentes nesta fatia. A próxima coleta usa a leitura
  normalizada; eventual correção de dados históricos exige uma revisão separada.

## Verificação

Simular o retorno real de `pg` nos testes do repositório, incluindo preço e data
repetidos. Rodar testes, typecheck, lint e build; verificar o deploy antes de
qualquer ação operacional sobre preços ou boletim.
