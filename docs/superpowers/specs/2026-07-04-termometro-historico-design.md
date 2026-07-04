# Histórico do Termômetro — gráfico de tendência (design)

> Fatia 11. Página de detalhe por produto do Termômetro com o gráfico da tendência da
> **mediana** dos preços reportados ao longo do tempo, reaproveitando o gráfico de
> cotações que já existe. Grátis, sem dependências novas, sem PII.

## Objetivo

O `/termometro` mostra hoje o "valor típico" (mediana) atual de cada produto. Falta ver
**para onde o preço da praça está indo**. Esta fatia adiciona uma página de detalhe por
produto — `/termometro/[produto]` — com o card atual no topo e, abaixo, o gráfico da
tendência da mediana diária dos últimos 90 dias, com o mesmo toggle 7/30/90 dias do
gráfico de cotações. Espelha o `/cotacao/[tipo]` que já existe.

## Decisões de design

- **Página de detalhe por produto** (escolhida no brainstorming), não sparkline inline
  nem página única — espelha o `/cotacao/[tipo]`, mantém o `/termometro` limpo.
- **Ponto = mediana diária** (fuso America/Araguaina, como o boletim), reaproveitando o
  helper `mediana()` da fatia 10. Um valor extremo num dia não puxa o ponto.
- **Reaproveitar `GraficoCotacao`** inteiro: ele já consome `PontoHistorico` (`{ data,
  valor }`) e traz o toggle 7/30/90 dias e o estado vazio. Zero componente novo de
  gráfico.
- **Janela de 90 dias** na query (o gráfico filtra 7/30/90 sobre isso), igual ao
  `/cotacao/[tipo]`.

## Arquitetura

```
lib/termometro-historico.ts          # historicoTermometro (puro): reportes -> pontos de mediana/dia
app/termometro/[produto]/page.tsx    # detalhe: card atual + gráfico de tendência
app/termometro/page.tsx              # cada card vira link para /termometro/[produto]
```

Reaproveita, sem alterar: `GraficoCotacao`, `CardTermometro`, `resumirReportes`,
`mediana`, `PRODUTOS`/`ORDEM_PRODUTOS`, `type PontoHistorico`.

### `lib/termometro-historico.ts` (lógica pura)

```ts
import type { PontoHistorico } from '@/types/cotacao';

export type ReporteHistorico = { valor: number; criado_em: string };

// Agrupa reportes de UM produto por dia (America/Araguaina) e devolve a mediana de
// cada dia, ordenado por data crescente. reportes já filtrados (aprovados, 1 produto).
export function historicoTermometro(reportes: ReporteHistorico[]): PontoHistorico[]
```

- O dia de cada reporte é o dia-calendário em `America/Araguaina` do seu `criado_em`
  (via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' })` → `YYYY-MM-DD`).
- Agrupa por essa chave de dia; para cada dia, `valor = mediana(valores do dia)`
  (helper da fatia 10, 2 casas).
- Devolve `{ data: 'YYYY-MM-DD', valor }[]` **ordenado por `data` crescente**.
- Lista vazia → `[]`.

`PontoHistorico` (já em `types/cotacao.ts`) é `{ data: string; valor: number }` — a
chave `data` no formato `YYYY-MM-DD` é aceita por `new Date(p.data)` no gráfico, como já
acontece com as cotações.

### `app/termometro/[produto]/page.tsx`

- `export const dynamic = 'force-dynamic'`.
- `const { produto } = await params;` — se `produto` não estiver em `ORDEM_PRODUTOS`,
  `notFound()`.
- Query (client público, RLS entrega só aprovados): reportes dos últimos **90 dias**
  desse produto — `select('valor, municipio, criado_em').eq('produto', produto)
  .gte('criado_em', desde)`.
- Busca `cotacoes` (`tipo, valor`) para o contraste CONAB, como no `/termometro`.
- **Card atual:** `resumirReportes(reportes do produto)` → `resumos[0]` (pode não existir
  se não houver reporte); quando existir, `<CardTermometro resumo={resumos[0]}
  mediaConab={conab.get(produto)} />`.
- **Gráfico:** `historicoTermometro(reportes)` → `pontos`; se `pontos.length === 0`,
  "Sem histórico ainda."; senão `<GraficoCotacao pontos={pontos}
  titulo={PRODUTOS[produto].rotulo} unidade={PRODUTOS[produto].unidade} />`.
- Sem nenhum reporte aprovado no período: sem card e "Sem histórico ainda." no gráfico.
- Link "← Voltar" para `/termometro`; título = `PRODUTOS[produto].rotulo`.
- `metadata`: título "{rótulo} — Termômetro da Praça".

### `app/termometro/page.tsx` (edição)

Cada card do painel passa a ser um **link** para `/termometro/{r.produto}`:

```tsx
<Link
  key={r.produto}
  href={`/termometro/${r.produto}`}
  className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
>
  <CardTermometro resumo={r} mediaConab={conab.get(r.produto)} />
</Link>
```

O `CardTermometro` continua um componente de apresentação puro (não muda). Um leve realce
de hover (ex.: `transition hover:shadow` no wrapper ou classe utilitária) sinaliza que é
clicável; o valor exato fica a critério da implementação, respeitando os tokens do app.

## Casos de borda

- **Produto inválido na URL:** `notFound()`.
- **Sem reportes no período:** sem card; gráfico mostra "Sem histórico ainda.".
- **1 reporte num dia:** ponto = o valor daquele dia.
- **Vários no mesmo dia, com extremo:** ponto = mediana do dia (extremo não puxa).
- **Fuso:** o dia é o de America/Araguaina, então um reporte de fim de noite cai no dia
  local correto, não no dia UTC.

## Testes (Vitest, padrão do projeto)

`tests/termometro-historico.test.ts`:
- vários reportes no mesmo dia → 1 ponto com a mediana daquele dia;
- dia com valor extremo → ponto é a mediana, não puxado pelo extremo;
- vários dias → pontos ordenados por data crescente;
- lista vazia → `[]`;
- dois `criado_em` que caem em dias diferentes em America/Araguaina viram dois pontos.

Página verificada por build + e2e (padrão do projeto: páginas não têm teste unitário).

## Fora do escopo

Reter reportes rejeitados no gráfico; recorte por município no histórico; retenção/
expurgo de reportes antigos; qualquer verificação de identidade (OTP) ou reputação —
essas continuam sendo sub-fatias futuras do T3, dependentes de decisão sobre provedor.

## Deploy

Sem migração, sem env nova, sem dependência. Suíte + build + lint; e2e local (popular
reportes de um produto em dias diferentes, abrir `/termometro/boi`, screenshot do card +
gráfico com o toggle); push com aprovação; verificação em produção; limpeza dos dados de
teste (escopada por `ip_hash`).
