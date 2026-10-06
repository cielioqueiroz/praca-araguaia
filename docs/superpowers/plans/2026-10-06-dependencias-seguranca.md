# Patches de segurança das dependências — plano

- [x] Atualizar Next e eslint-config-next para 15.5.24.
- [x] Atualizar Vitest para 4.1.11 e PostCSS para a versão corrigida.
- [x] Fixar transitivas corrigidas sem trocar a major do framework.
- [x] Reinstalar e conferir a árvore efetiva.
- [x] Rodar `npm audit` e registrar qualquer advisory sem correção publicada.
- [x] Rodar testes, typecheck, lint e build.

## Resultado do audit

O total caiu de 42 (3 críticas, 38 altas, 1 moderada) para 5 altas. As cinco são a
mesma cadeia de ferramentas: `eslint-config-next → @next/eslint-plugin-next → fast-glob
→ micromatch → braces@3.0.3`. O npm oferece apenas `--force`, que faria downgrade para
`eslint-config-next@14.2.35`; isso quebraria o pareamento com Next 15.5.24 e viola a
regra do repositório. Não existe `braces@3.0.4` publicada nesta data.
