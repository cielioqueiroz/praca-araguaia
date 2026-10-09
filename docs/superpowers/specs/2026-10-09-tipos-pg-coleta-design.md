# Contrato dos tipos PostgreSQL e datas de fechamento

## Problema

O driver `pg` entrega `numeric` como texto, `timestamptz` como `Date` e `bigint`
como texto por padrão. O projeto **já** configura conversores globais em
`lib/neon/cliente.ts`, antes de criar qualquer pool. Uma checagem isolada do parser
padrão levou à hipótese errada de que os repositórios SQL recebiam esses tipos
brutos. Converter novamente em cada repositório duplicaria uma regra existente.

Há, porém, uma comparação de datas em `lib/coleta.ts` baseada na ordem lexical
das strings. Dois textos ISO do mesmo instante, como `...00Z` e `...00.000Z`,
podem ter ordem lexical diferente. A lógica deve comparar o instante, preservando
a variação e o “Estável desde” quando o fechamento é o mesmo.

## Decisão

- Manter a conversão de `numeric`, `timestamptz`, `date` e `bigint` só na
  configuração global do `pg` e testar esse contrato diretamente.
- Comparar as datas de fechamento pelo instante nas funções puras de variação
  e última mudança, sem alterar os valores publicados ou o esquema do banco.
- Retirar as conversões redundantes que chegaram ao repositório no primeiro
  commit desta fatia. A coleta executada entre os commits mostrou o resultado
  esperado, mas não prova que essas conversões eram necessárias.

## Verificação

Testes do parser configurado e de datas ISO equivalentes, suíte, typecheck,
lint e build. Verificar o deploy e acompanhar o fechamento agendado.
