# Calculadora do Produtor (design)

> Fatia 14. Uma calculadora prática em `/calculadora`: quanto vale um lote de boi (peso
> vivo + rendimento → arrobas → R$) e uma colheita de grãos (sacas → R$), com os preços
> pré-preenchidos das cotações ao vivo do app. Grátis, só front, sem banco (só leitura),
> sem dependências.

## Objetivo

Dar ao produtor as duas contas que ele faz na porteira, já conectadas aos preços do app:
o valor de um lote de boi gordo a partir do peso vivo e do rendimento de carcaça, e o
valor de uma colheita de soja/milho a partir das sacas. O preço vem pré-preenchido da
cotação atual (editável), então o produtor só entra com o que é dele (peso, rendimento,
sacas). Nada é gravado; é uma ferramenta de cálculo.

> Contexto: esta fatia substituiu a ideia de "cotações por município da CONAB", que se
> mostrou inviável — o arquivo municipal traz boi/soja/milho ~6 meses desatualizados,
> enquanto a média estadual atual é fresca.

## Decisões de design

- **Duas contas de valor** (boi e grãos), não só conversores de unidade — é o que agrega
  valor de verdade.
- **Preço pré-preenchido das cotações ao vivo** e **editável** — conecta a ferramenta ao
  resto do app sem prender o produtor a ele.
- **Arroba do boi = 15 kg de carcaça**: `arrobas = pesoVivo × rendimento% ÷ 15`. Rendimento
  padrão **50%**.
- **Saca = 60 kg**.
- **Só front + leitura de cotações** — sem escrita no banco, sem dependências, sem PII.
- Reusa `normalizarValor` (parser pt-BR já existente) para os campos numéricos.

## Arquitetura

```
lib/calculadora.ts          # funções puras: arrobasDeBoi, valorEmReais, sacas<->kg
components/Calculadora.tsx   # client: dois blocos (boi, grãos), recalcula ao digitar
app/calculadora/page.tsx    # server: busca preços atuais e monta a calculadora
components/Header.tsx        # + item "Calculadora" no menu
```

Sem banco de escrita, sem rotas de API, sem dependências novas.

### `lib/calculadora.ts` (lógica pura)

```ts
// A arroba do boi gordo é 15 kg de carcaça; rendimento converte peso vivo em carcaça.
export function arrobasDeBoi(pesoVivoKg: number, rendimentoPct: number): number;
// Genérico: arrobas × R$/@ (boi) ou sacas × R$/sc (grãos).
export function valorEmReais(quantidade: number, preco: number): number;
export function sacasParaKg(sacas: number): number;   // × 60
export function kgParaSacas(kg: number): number;       // ÷ 60
```

- Todas arredondam a **2 casas**. Entrada não-finita ou negativa (`NaN`, campo vazio,
  valor < 0) → **0** (a calculadora nunca mostra `NaN`).
- `arrobasDeBoi(480, 50)` = `480 × 0,5 ÷ 15` = **16**. `valorEmReais(16, 320)` = **5120**.

### `app/calculadora/page.tsx` (server, `force-dynamic`)

- Lê as cotações atuais com o client público: `select('tipo, valor').in('tipo', ['boi','soja','milho'])`.
- Monta `precos = { boi, soja, milho }` (número ou `undefined` se não houver cotação) e
  passa para `<Calculadora precos={precos} />`.
- Cabeçalho ("Calculadora do produtor" + subtítulo curto). `metadata` título
  "Calculadora — Praça Araguaia".

### `components/Calculadora.tsx` (client)

Recebe `{ precos: { boi?: number; soja?: number; milho?: number } }`. Estado por campo
(strings dos inputs); recalcula na renderização com as funções puras (parse via
`normalizarValor`). Dois blocos em cards no estilo do app:

- **Boi gordo:** campos `peso vivo (kg)`, `rendimento (%)` (padrão `'50'`), `preço (R$/@)`
  (padrão `precos.boi` formatado, ou vazio). Saída: **arrobas** (`arrobasDeBoi`) e **valor
  total** (`valorEmReais(arrobas, preço)`), em pt-BR.
- **Grãos:** seletor `produto` (soja/milho — troca o preço padrão para `precos.soja`/
  `precos.milho`), campo `sacas` (com o equivalente em kg ao lado via `sacasParaKg`),
  campo `preço (R$/sc)` (padrão do produto escolhido). Saída: **valor da colheita**
  (`valorEmReais(sacas, preço)`).
- Números formatados com `Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0,
  maximumFractionDigits: 2 })`; valores em R$ com o mesmo padrão dos cards. Inputs
  `inputMode="decimal"`. Tokens visuais do projeto.

### `components/Header.tsx`

Acrescentar `{ href: '/calculadora', rotulo: 'Calculadora' }` ao array `LINKS`.

## Casos de borda

- **Campo vazio / não numérico:** a função pura recebe 0 (via `normalizarValor` →
  `NaN` → guarda) e devolve 0; a saída mostra `0`, nunca `NaN`.
- **Sem cotação de um produto:** o campo de preço começa vazio; o produtor digita.
- **Rendimento fora de 0–100:** não é travado (o produtor pode ter um caso atípico); o
  cálculo segue a fórmula. Valor negativo → 0 pela guarda.
- **Troca de produto nos grãos:** o preço padrão acompanha o produto escolhido (só
  enquanto o produtor não tiver editado o campo manualmente — ver nota de implementação).

> Nota de implementação: ao trocar o produto dos grãos, o preço volta ao padrão do novo
> produto. Manter isso simples (o campo de preço reflete o produto atual) é aceitável;
> não é necessário preservar uma edição manual entre trocas de produto.

## Testes (Vitest, padrão do projeto)

`tests/calculadora.test.ts`:
- `arrobasDeBoi`: `(480, 50) → 16`; `(500, 52) → 17.33` (2 casas); rendimento 0 → 0;
  peso vazio/NaN → 0.
- `valorEmReais`: `(16, 320) → 5120`; `(10.5, 2.5) → 26.25`; entrada NaN/negativa → 0.
- `sacasParaKg` / `kgParaSacas`: `10 → 600`; `600 → 10`; arredondamento; NaN → 0.

`tests/components/Calculadora.test.tsx`:
- pré-preenche o preço do boi vindo de `precos.boi`;
- digitar peso `480` e rendimento `50` (preço `320`) mostra `16` arrobas e `5.120` de
  valor;
- no bloco grãos, `10` sacas mostra `600` kg e, com o preço da soja, o valor da colheita;
- trocar o produto para milho troca o preço padrão.

Página verificada por build + e2e (padrão do projeto para páginas).

## Fora do escopo

Produtividade por hectare, ganho de peso/diária, custo de produção, salvar/compartilhar
cálculos, histórico. Entram em fatias futuras se fizer sentido.

## Deploy

Sem migração, sem env, sem dependência. Suíte + build + lint; e2e local (a página abre com
os preços pré-preenchidos; digitar mostra arrobas/valor; grãos calcula e converte); push
com aprovação; verificação em produção.
