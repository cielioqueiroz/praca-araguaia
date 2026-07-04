# Histórico do Termômetro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página de detalhe `/termometro/[produto]` com o card atual + gráfico da tendência da mediana diária dos preços reportados, reaproveitando o gráfico de cotações.

**Architecture:** Uma função pura (`historicoTermometro`) agrega os reportes de um produto em pontos de mediana por dia (fuso America/Araguaina); a página monta o card atual (via `resumirReportes`/`CardTermometro`) e o gráfico (via `GraficoCotacao`, que já consome `PontoHistorico`); os cards do `/termometro` viram links para a página de detalhe. Sem banco, deps, PII ou rotas.

**Tech Stack:** Next 15 App Router, TypeScript strict, Vitest, Recharts (via `GraficoCotacao` já existente), Supabase (client público), Tailwind v4.

## Global Constraints

- Zero dependências novas, sem migração, sem env, sem rotas de API.
- Ponto = **mediana diária** (fuso `America/Araguaina`), via o helper `mediana` de `@/lib/termometro` (2 casas). Um extremo no dia não puxa o ponto.
- `PontoHistorico = { data: string; valor: number }` (já em `types/cotacao.ts`), `data` no formato `YYYY-MM-DD`, ordem **ascendente**.
- Janela de **90 dias** na query; o `GraficoCotacao` filtra 7/30/90.
- Produto inválido na URL → `notFound()`. Sem reportes → sem card e "Sem histórico ainda." no gráfico.
- Reaproveitar sem alterar comportamento: `GraficoCotacao`, `CardTermometro`, `resumirReportes`, `mediana`, `PRODUTOS`/`ORDEM_PRODUTOS`.
- Textos de UI em português brasileiro; tokens visuais do projeto (mata/pasto/papel/linha/tinta) e realce de foco `focus-visible:outline-pasto`.

---

### Task 1: Agregação de histórico (`lib/termometro-historico.ts`)

**Files:**
- Create: `lib/termometro-historico.ts`
- Test: `tests/termometro-historico.test.ts`

**Interfaces:**
- Consumes: `mediana(valores: number[]): number` de `@/lib/termometro`; `type PontoHistorico = { data: string; valor: number }` de `@/types/cotacao`.
- Produces (consumido pela Task 2):
  - `type ReporteHistorico = { valor: number; criado_em: string }`
  - `historicoTermometro(reportes: ReporteHistorico[]): PontoHistorico[]` — mediana por dia (America/Araguaina), ordem ascendente por `data`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `tests/termometro-historico.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { historicoTermometro } from '@/lib/termometro-historico';

// Helper: timestamp ISO em UTC (o agrupamento converte para America/Araguaina, UTC-3).
const r = (criado_em: string, valor: number) => ({ criado_em, valor });

describe('historicoTermometro', () => {
  it('lista vazia devolve vazio', () => {
    expect(historicoTermometro([])).toEqual([]);
  });

  it('vários reportes no mesmo dia viram um ponto com a mediana do dia', () => {
    const pontos = historicoTermometro([
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-01T13:00:00Z', 320),
      r('2026-07-01T14:00:00Z', 310),
    ]);
    expect(pontos).toEqual([{ data: '2026-07-01', valor: 310 }]);
  });

  it('um extremo no dia não puxa o ponto (mediana, não média)', () => {
    const pontos = historicoTermometro([
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-01T13:00:00Z', 310),
      r('2026-07-01T14:00:00Z', 320),
      r('2026-07-01T15:00:00Z', 330),
      r('2026-07-01T16:00:00Z', 900),
    ]);
    expect(pontos).toEqual([{ data: '2026-07-01', valor: 320 }]); // mediana; a média seria 432
  });

  it('vários dias saem ordenados por data crescente', () => {
    const pontos = historicoTermometro([
      r('2026-07-03T12:00:00Z', 340),
      r('2026-07-01T12:00:00Z', 300),
      r('2026-07-02T12:00:00Z', 320),
    ]);
    expect(pontos).toEqual([
      { data: '2026-07-01', valor: 300 },
      { data: '2026-07-02', valor: 320 },
      { data: '2026-07-03', valor: 340 },
    ]);
  });

  it('agrupa pelo dia de America/Araguaina, não pelo dia UTC', () => {
    // 2026-07-02T01:00:00Z = 2026-07-01 22:00 em Araguaina (UTC-3) -> cai no dia 01.
    const pontos = historicoTermometro([
      r('2026-07-02T01:00:00Z', 300),
      r('2026-07-02T12:00:00Z', 400),
    ]);
    expect(pontos).toEqual([
      { data: '2026-07-01', valor: 300 },
      { data: '2026-07-02', valor: 400 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/termometro-historico.test.ts`
Expected: FAIL — `Cannot find module '@/lib/termometro-historico'`.

- [ ] **Step 3: Implementar `lib/termometro-historico.ts`**

```ts
import { mediana } from '@/lib/termometro';
import type { PontoHistorico } from '@/types/cotacao';

export type ReporteHistorico = { valor: number; criado_em: string };

// en-CA formata como YYYY-MM-DD; timeZone converte o instante para o dia local da praça.
const diaAraguaia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Araguaina',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Agrupa reportes de UM produto (já aprovados) por dia local e devolve a mediana de cada
// dia, ordenado por data crescente.
export function historicoTermometro(reportes: ReporteHistorico[]): PontoHistorico[] {
  const porDia = new Map<string, number[]>();
  for (const { criado_em, valor } of reportes) {
    const dia = diaAraguaia.format(new Date(criado_em));
    const lista = porDia.get(dia);
    if (lista) lista.push(valor);
    else porDia.set(dia, [valor]);
  }
  return [...porDia.entries()]
    .map(([data, valores]) => ({ data, valor: mediana(valores) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/termometro-historico.test.ts`
Expected: PASS (5 casos).

- [ ] **Step 5: Commit**

```bash
git add lib/termometro-historico.ts tests/termometro-historico.test.ts
git commit -m "feat: historicoTermometro agrega reportes em mediana diaria"
```

---

### Task 2: Página de detalhe + cards clicáveis

**Files:**
- Create: `app/termometro/[produto]/page.tsx`
- Modify: `app/termometro/page.tsx` (cada card vira link para `/termometro/[produto]`)

**Interfaces:**
- Consumes: `historicoTermometro`, `type ReporteHistorico` (Task 1); `resumirReportes`, `PRODUTOS`, `ORDEM_PRODUTOS`, `type ProdutoTermometro` de `@/lib/termometro`; `CardTermometro`, `GraficoCotacao`; `createPublicClient`; `notFound` de `next/navigation`.
- Produces: nenhum (fatia final).

- [ ] **Step 1: Implementar `app/termometro/[produto]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { resumirReportes, PRODUTOS, ORDEM_PRODUTOS, type ProdutoTermometro } from '@/lib/termometro';
import { historicoTermometro, type ReporteHistorico } from '@/lib/termometro-historico';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params;
  const info = PRODUTOS[produto as ProdutoTermometro];
  return { title: info ? `${info.rotulo} — Termômetro da Praça` : 'Termômetro da Praça' };
}

export default async function HistoricoProduto({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params;
  if (!ORDEM_PRODUTOS.includes(produto as ProdutoTermometro)) notFound();
  const info = PRODUTOS[produto as ProdutoTermometro];

  const supabase = createPublicClient();
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  // A RLS entrega só aprovados para o client anon.
  const { data: reportes } = await supabase
    .from('reportes')
    .select('valor, municipio, criado_em')
    .eq('produto', produto)
    .gte('criado_em', desde);

  const { data: cotacoes } = await supabase.from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const linhas = (reportes ?? []).map((x) => ({
    produto,
    municipio: x.municipio as string,
    valor: Number(x.valor),
  }));
  const resumo = resumirReportes(linhas)[0]; // 1 produto -> 0 ou 1 resumo

  const pontos = historicoTermometro(
    (reportes ?? []).map((x): ReporteHistorico => ({ valor: Number(x.valor), criado_em: x.criado_em as string })),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/termometro" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-mata">{info.rotulo}</h1>

      {resumo && (
        <div className="mt-6 max-w-sm">
          <CardTermometro resumo={resumo} mediaConab={conab.get(produto)} />
        </div>
      )}

      <section className="mt-10">
        <div className="border-b border-linha pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Tendência</h2>
        </div>
        <div className="mt-4">
          {pontos.length === 0 ? (
            <p className="text-tinta/50">Sem histórico ainda.</p>
          ) : (
            <GraficoCotacao pontos={pontos} titulo={info.rotulo} unidade={info.unidade} />
          )}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Tornar os cards do `/termometro` clicáveis**

Em `app/termometro/page.tsx`, adicionar o import do `Link` (se ainda não houver — o arquivo já importa `Link` de `next/link`) e envolver cada `CardTermometro` da grade num `Link`. Substituir o bloco atual da seção (linhas ~47–52):

```tsx
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {resumos.map((r) => (
            <CardTermometro key={r.produto} resumo={r} mediaConab={conab.get(r.produto)} />
          ))}
        </section>
```

por:

```tsx
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {resumos.map((r) => (
            <Link
              key={r.produto}
              href={`/termometro/${r.produto}`}
              className="rounded-xl transition hover:shadow-[0_2px_10px_rgba(28,38,32,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              <CardTermometro resumo={r} mediaConab={conab.get(r.produto)} />
            </Link>
          ))}
        </section>
```

(O `CardTermometro` não muda; o `Link` é o wrapper. `app/termometro/page.tsx` já importa `Link` de `next/link` — confirmar no topo do arquivo e manter.)

- [ ] **Step 3: Checagem de tipos, testes, build e lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: toda a suíte PASS (177: os 172 + 5 novos), build e lint limpos. A página `/termometro/[produto]` aparece como rota dinâmica no build.

- [ ] **Step 4: Commit**

```bash
git add app/termometro/[produto]/page.tsx app/termometro/page.tsx
git commit -m "feat: pagina de historico do termometro por produto + cards clicaveis"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch (opus) — padrão das fatias anteriores.
2. E2E local: subir o dev server; popular reportes aprovados de boi em **dias diferentes** (para formar linha) e um dia com extremo; abrir `/termometro` (cards clicáveis), clicar no boi → `/termometro/boi`, screenshot confirmando o card atual + gráfico com o toggle 7/30/90 e a mediana não puxada; testar produto inválido (`/termometro/cafe` → 404). Limpar os dados de teste (escopar `delete` por `ip_hash`).
3. Push com aprovação → deploy; verificação em produção; limpeza.
4. Atualizar `ESTADO-DO-PROJETO.md` (fatia 11) e memória.

## Self-Review (feito)

- **Cobertura da spec:** `historicoTermometro` mediana/dia + ordem + fuso Araguaina (Task 1); página com card + gráfico + `notFound` + estado vazio (Task 2); cards clicáveis (Task 2); testes da função pura (Task 1); página por build+e2e. ✔
- **Placeholders:** nenhum — todo passo traz o código real. ✔
- **Consistência de tipos:** `ReporteHistorico { valor, criado_em }` e `historicoTermometro(...): PontoHistorico[]` idênticos entre Task 1 (definição) e Task 2 (consumo); `PontoHistorico { data, valor }` conferido em `types/cotacao.ts`; `GraficoCotacao` recebe `pontos/titulo/unidade` como na sua assinatura real. ✔
