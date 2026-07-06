# P1 — Navegação mobile (menu hambúrguer) — Design

**Data:** 2026-07-06
**Contexto:** auditoria de layout apontou que o header com 6 itens (Cotações, Boletim,
Chuva, Termômetro, Fornecedores, Calculadora) quebra em 2 linhas no celular — e o
público é o produtor no celular. Primeira das 3 fatias de layout (P1→P2→P3).

## Objetivo

No celular, topo enxuto (logo + botão ☰) que abre uma gaveta com os 6 itens. No
desktop, o menu no topo continua igual. De quebra, destacar a página atual.

## Comportamento

Breakpoint Tailwind `sm` (640px):
- **≥640px (desktop):** menu inline no topo, como hoje.
- **<640px (celular):** logo + botão ☰. Tocar abre uma gaveta (painel que desce,
  fundo `mata`) com os 6 itens em lista vertical. Tocar num item navega e fecha;
  botão vira ✕ pra fechar; tecla Esc fecha.

**Item ativo:** o link da rota atual recebe realce + `aria-current="page"`, no
desktop e na gaveta. Regra: `/` casa exato; demais casam por `startsWith(href)`
(`/termometro/x`→Termômetro, `/fornecedores/anunciar`→Fornecedores,
`/cotacao/x`→fica sem destaque, aceitável).

## Componentes

- `components/Header.tsx` (server) — renderiza o `<header>` + logo, delega a
  navegação ao `<NavPrincipal />`.
- `components/NavPrincipal.tsx` (**novo, client**) — `'use client'`, detém os
  `LINKS`, `useState(aberto)`, `usePathname()`. Renderiza:
  - Desktop: `<nav className="hidden sm:flex …">` com os links (ativo realçado).
  - Mobile: botão `sm:hidden` (☰/✕, `aria-expanded`, `aria-controls`, `aria-label`)
    + gaveta (`id` casando o `aria-controls`) que aparece só quando `aberto`, com
    os links (ativo realçado); cada link tem `onClick` que fecha; `Escape` fecha.

`LINKS` (inalterado): Cotações `/`, Boletim `/boletim`, Chuva `/chuva`, Termômetro
`/termometro`, Fornecedores `/fornecedores`, Calculadora `/calculadora`.

## Acessibilidade

- Botão: `aria-label` alterna "Abrir menu"/"Fechar menu"; `aria-expanded`;
  `aria-controls` aponta pro id da gaveta.
- `focus-visible` nos links e no botão (padrão já usado no projeto).
- `Escape` fecha a gaveta (listener enquanto aberto).
- Link ativo com `aria-current="page"`.

## Testes

`tests/components/NavPrincipal.test.tsx` (mock `next/navigation` → `usePathname`):
- Renderiza os 6 links (nav desktop, sempre no DOM).
- Rota atual `/chuva` → o link "Chuva" tem `aria-current="page"`; os outros não.
- Botão ☰: `aria-expanded="false"` inicial; após clicar, `aria-expanded="true"` e a
  gaveta (segunda instância dos links / região com o `id`) aparece.
- Clicar num link da gaveta fecha (`aria-expanded` volta a "false").

## Restrições

- Zero dependências novas (React + `usePathname` do Next).
- Zero mudança de comportamento fora da navegação; nenhuma outra página muda.
- Desktop permanece idêntico ao atual.

## Fora de escopo (YAGNI)

- Animação de slide/transição elaborada, backdrop escurecido, foco-trap completo.
- Reordenar/agrupar itens do menu.
