# P2 — Home mais forte (sparklines nos cards) — Design

**Data:** 2026-07-06
**Contexto:** auditoria apontou que os cards da home só mostram seta + %, sem a
direção de relance, e que no desktop os cards ficam "esparsos" (espaço vazio à
direita). Segunda das 3 fatias de layout (P1✓→P2→P3).

## Objetivo

Cada card de cotação ganha uma **mini-tendência (sparkline)** dos últimos ~30 dias.
Dá a direção num olhar e, de quebra, preenche o espaço vazio do card no desktop.

## Arquitetura

- `lib/sparkline.ts` (**novo, puro**): `caminhoSparkline(valores, largura, altura)`
  → string de pontos de uma `<polyline>` SVG. `<2` valores → `''`. Valor maior →
  `y` menor (linha sobe). Valores todos iguais → linha reta no meio.
- `components/Sparkline.tsx` (**novo**): renderiza um `<svg><polyline/></svg>`
  responsivo (largura 100%), cor pela própria tendência (último ≥ primeiro →
  `emerald-600`; senão `red-600` — mesma semântica da seta). `<2` valores → nada.
- `components/CardCotacao.tsx` (modificar): prop opcional `historico?: number[]`;
  se vier com ≥2 pontos, renderiza `<Sparkline>` entre o valor e a data.
- `app/page.tsx` (modificar): além do snapshot atual, busca
  `cotacoes_historico` dos últimos 30 dias (public client — já legível pela página
  de detalhe), agrupa por tipo em ordem cronológica e passa `historico` a cada card.

## Fluxo de dados

```
home → cotacoes (atual) + cotacoes_historico (30d)
     → agrupa historico por tipo (valores em ordem)
     → CardCotacao(historico) → Sparkline(caminhoSparkline)
```

## Tratamento de erros / bordas

- Sem histórico (tipo novo, <2 pontos) → card sem sparkline (comportamento atual).
- Falha na leitura do histórico → cards sem sparkline; cotações seguem (o `error`
  atual cobre a falha do snapshot).
- Semanal (CONAB) rende ~4–5 pontos em 30d; diário (câmbio) ~20–30. Ambos ok.

## Testes

- `lib/sparkline.ts`: `[]`/`[5]` → `''`; `[1,2,3]` (90×30) → `'0,30 45,15 90,0'`;
  `[2,2]` (90×30) → `'0,15 90,15'` (reta no meio).
- `components/Sparkline.tsx`: renderiza `<polyline>` com ≥2 valores; nada com <2;
  cor `#059669` quando sobe, `#dc2626` quando cai.
- `components/CardCotacao.tsx`: com `historico` de ≥2 pontos, aparece um `<svg>`;
  sem `historico`, nenhum `<svg>` (testes atuais seguem verdes — prop é opcional).

## Restrições

- Zero dependências novas (SVG puro, sem lib de gráfico).
- `historico` opcional → nenhuma outra tela quebra; testes atuais do card intactos.

## Fora de escopo (YAGNI)

- Eixos, tooltip, pontos marcados (é sparkline, não gráfico — o detalhe já tem o
  gráfico completo). Área preenchida sob a linha. Escolha de janela (fixo 30d).
