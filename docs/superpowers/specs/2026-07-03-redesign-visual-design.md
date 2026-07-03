# Redesign Visual — Design

> Design doc — 2026-07-03 — Fatia 7 da Praça Araguaia.
> O usuário considerou o visual atual fraco (era o mínimo utilitário das fatias funcionais). Esta fatia dá identidade própria ao app, sem mudar comportamento nem quebrar os 101 testes.

## 1. Direção

**Sujeito:** o quadro de cotações da praça, para o produtor do Araguaia no celular. O trabalho da página: em segundos, ver o preço de hoje e a direção.

**Tokens (Tailwind v4 `@theme`):**

| Token | Valor | Uso |
|---|---|---|
| `mata` | `#1c3a2b` | header/footer, títulos display (verde profundo da mata de galeria) |
| `pasto` | `#15803d` | marca/ações/acentos (o verde do broto do logo) |
| `palha` | `#f6f4ec` | fundo do app |
| `papel` | `#fffdf7` | superfície dos cards (mesma do boletim — consistência site ↔ card) |
| `linha` | `#e7e3d6` | bordas/hairlines quentes |
| `tinta` | `#20241f` | texto |
| `rio` | `#0e7490` | acentos da página de chuva |

Alta/baixa continuam semânticos (`emerald-600`/`red-600`) — iguais ao boletim.

**Tipografia:** display **Bricolage Grotesque** (`next/font`, var `--font-display`) para marca, títulos e os **números grandes** (tabular-nums — o número é o material principal do design); corpo continua **Geist** (a personalidade vem do display, cor e estrutura).

**Estrutura que informa:** o painel agrupa as cotações em duas seções com cabeçalho próprio — **"Na porteira"** (boi/soja/milho — média MT/PA/TO/GO, semanal) e **"Mercado"** (dólar/euro/ouro — câmbio e reservas, diário). A legenda regional sobe para o cabeçalho da seção (o card do painel fica mais limpo; a legenda por card continua na página de detalhe).

**Assinatura:** números display grandes com a unidade como etiqueta pequena acima (etiqueta de balança); no `/chuva`, **barra proporcional de mm** por dia (0–30 mm) na cor `rio`.

**Shell:** header em faixa `mata` com broto + "Praça Araguaia" + nav (Cotações · Boletim · Chuva); footer com fontes. Título da aba vira "Praça Araguaia — cotações do agro". Motion mínima: hover lift nos cards, focus visível.

## 2. Arquivos

| Arquivo | Ação |
|---|---|
| `app/globals.css` | `@theme` com os tokens de cor + `--font-display` |
| `app/layout.tsx` | + Bricolage Grotesque; body `bg-palha`; `Header`/`Footer`; metadata |
| `components/Header.tsx`, `components/Footer.tsx` | Criar (server components) |
| `components/CardCotacao.tsx` | Restyle: papel/linha, título+variação na mesma linha, unidade como etiqueta, valor em display tabular. **Preserva** textos e classes assertados nos testes (`▲/▼`, `text-red-600`, `desatualizado`, legenda) |
| `app/page.tsx` | Hero curto (eyebrow + "A praça hoje" + data) + seções Na porteira/Mercado; remove links duplicados (nav no header) |
| `app/cotacao/[tipo]/page.tsx` | Shell/títulos display |
| `components/CardChuva.tsx` | Barra de mm proporcional; colunas com largura fixa (corrige o desalinhamento anotado no review). **Preserva** `font-semibold`, `—`, `20–33°C`, 7 `<li>` |
| `app/chuva/page.tsx`, `app/boletim/page.tsx` | Shell/títulos display |
| `components/GraficoCotacao.tsx` | Botões no novo estilo (ativo `mata`) |

## 3. Restrições

- **Zero mudanças de comportamento**: dados, rotas, coleta, boletim PNG intactos.
- **Os 101 testes continuam passando sem alteração** (textos/classes assertados preservados).
- Zero dependências novas (Bricolage vem por `next/font`).
- Responsivo (1 coluna no mobile, 3 no desktop); `focus-visible` nos links/botões.

## 4. Critérios de sucesso

1. Identidade consistente em `/`, `/cotacao/[tipo]`, `/chuva` e `/boletim` (header, palha, papel, display).
2. Painel agrupado em Na porteira/Mercado com números display tabulares.
3. `/chuva` com barras de mm e colunas alinhadas.
4. 101 testes verdes **sem tocar nos testes**; build/lint limpos; deploy.
