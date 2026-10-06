# Patches de segurança das dependências — 06/10/2026

## Problema

O `npm audit`, zerado no commit anterior, passou a apontar novas vulnerabilidades após
a publicação de advisories. As duas de produção mais graves atingem Next `<15.5.24` e
Sharp `<0.35.4`. O ambiente de testes também é atingido em Vitest `<4.1.11`.

## Decisões

- Manter o Next na major 15 e subir para `15.5.24`.
- Manter `eslint-config-next` na mesma versão do framework.
- Subir Vitest para `4.1.11`; a compatibilidade será decidida pela suíte inteira.
- Atualizar PostCSS e usar overrides apenas nas dependências transitivas com versão
  corrigida publicada.
- Não usar `npm audit fix --force`.
- Não forçar `braces`: em 06/10/2026 o advisory inclui `<=3.0.3` e não há `3.0.4`
  publicada. Um override inventado quebraria a árvore sem fechar o risco.

## Aceite

- 582 testes, typecheck, lint e build continuam verdes.
- `npm audit` não acusa as falhas críticas de Next, Sharp, Vitest ou Tinypool.
- Qualquer advisory restante fica registrado com a razão concreta.

