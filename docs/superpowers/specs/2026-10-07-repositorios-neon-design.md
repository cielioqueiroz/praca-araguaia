# Repositórios SQL para os fluxos de escrita no Neon

## Problema

A ponte PostgREST em `lib/neon/cliente.ts` reproduz consultas simples, mas não agrupa
as várias escritas de uma coleta em transações. Uma falha entre o histórico e o
retrato atual pode deixar um produto parcialmente gravado. A reserva do boletim e
as decisões de moderação também merecem SQL explícito, com condições no próprio
banco para manter a proteção contra repetição e decisões concorrentes.

## Decisão

- Criar repositórios SQL por domínio para coleta, boletim e moderação no Neon.
- Uma coleta de um tipo e suas séries por lugar são gravadas em uma transação por
  chamada; uma falha reverte o conjunto daquela chamada. Tipos independentes
  continuam isolados, pois a fonte de um pode falhar sem apagar as demais.
- A reserva do boletim usa a chave única `(dia, sessao)` e `on conflict do nothing`.
  Uma reserva iniciada não é liberada por falha parcial de envio.
- Decisões de moderação alteram só a linha no estado esperado, em uma instrução
  `update ... where ... returning`, preservando a distinção entre erro e 404.
- O caminho Supabase fica como retorno temporário. Leituras de página continuam
  na ponte até uma fatia posterior; o número de consultas pela ponte cai nos
  fluxos mais sensíveis a concorrência e falhas parciais.

## Verificação

Testes de transação e concorrência, typecheck, lint, suíte completa e build. Em
produção, conferir as páginas e depois o registro do fechamento automático;
nenhum disparo manual integra esta verificação.
