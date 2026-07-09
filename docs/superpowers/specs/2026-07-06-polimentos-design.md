# P3 — Polimentos de layout — Design

**Data:** 2026-07-06
**Contexto:** três acertos finos apontados na auditoria de layout. Terceira das 3
fatias (P1✓→P2✓→P3).

## Itens

### A) Cor da linha do gráfico de tendência no brand
`components/GraficoCotacao.tsx` usa `color: 'hsl(142 71% 45%)'` (verde "neon") na
linha. Trocar pelo verde da marca `pasto` (`#15803d`) — o mesmo dos acentos/ações.
Sem mudança de comportamento; só a cor do traço.

### B) Preço pré-preenchido da calculadora em pt-BR
`components/Calculadora.tsx` mostra o preço vindo das cotações como `String(v)` →
`321.26` (ponto). Trocar `precoInicial` por `v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })`
→ `321,26`. Sem mínimo de casas: inteiros seguem iguais (`320`→`320`), só os
decimais ganham a vírgula. `normalizarValor` já parseia vírgula, então o input
continua editável e o cálculo idêntico.

### C) Texto do empty state de Fornecedores
`components/VitrineFornecedores.tsx` diz "Vitrine em breve — estamos reunindo os
fornecedores da praça", desatualizado agora que qualquer um se cadastra. Trocar por:
- Título: "Ainda não há fornecedores na vitrine."
- Sub: "É o primeiro da praça? Use o botão \"Anuncie aqui\" acima e apareça aqui."

## Testes

- **A:** sem teste novo (cor é visual; a suíte atual do gráfico segue verde).
- **B:** os testes atuais da calculadora (valores inteiros `320`/`130`/`55`) passam
  sem mudança; **adicionar** um caso: `precos={{ boi: 321.26 }}` → input com `321,26`.
- **C:** atualizar o teste do empty state (`tests/components/VitrineFornecedores.test.tsx`)
  para casar o novo texto ("Ainda não há fornecedores").

## Restrições

- Zero dependências novas. Zero mudança de comportamento além do visual/cópia.
- Fixes independentes; podem ir num único commit.
