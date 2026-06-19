# Gráfico de Tendência do Dólar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página de detalhe `/cotacao/dolar` com gráfico de tendência do dólar, alimentada por backfill (~90 dias) do BCB + a coleta diária já existente.

**Architecture:** Rota protegida `/api/backfill` popula `cotacoes_historico` com a série do BCB de forma idempotente (constraint única). A página de detalhe (Server Component) lê a cotação atual + 90 dias de histórico e passa para um componente cliente `GraficoCotacao` (shadcn/ui Chart, baseado em Recharts) com toggle de período 7/30/90 filtrado no cliente.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind, Supabase, shadcn/ui + Recharts, Vitest.

## Global Constraints

- Next.js 15, TypeScript strict, Tailwind. Não quebrar o painel/coleta já no ar.
- Dinheiro como `number`; datas em ISO 8601 (UTC). Offset BRT fixo `-03:00` (reusar `OFFSET_BRT` em `lib/fontes/dolar.ts`).
- Service role key só no servidor (rota de backfill). Leitura pública via anon key.
- Fonte do histórico: BCB SGS série 1 — `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/{dias}?formato=json` (resposta `[{ "data":"dd/MM/yyyy", "valor":"5.0123" }]`, asc).
- Backfill idempotente: `on conflict (tipo, data_referencia) do nothing`.
- Commits frequentes, um por tarefa.

---

## Estado atual do código (já existe)

- `types/cotacao.ts`: `Cotacao`, `CotacaoSalva`, `CotacaoRepo`.
- `lib/fontes/dolar.ts`: `buscarDolarAwesome`, `buscarDolarBcb`, `buscarDolar` (fallback), `const OFFSET_BRT = '-03:00'`.
- `lib/coleta.ts`: `coletarCotacao(fonte, repo)`.
- `lib/supabase/{server,public,repo}.ts`: `createServerClient`, `createPublicClient`, `supabaseRepo(client): CotacaoRepo`.
- `components/CardCotacao.tsx`: props `{ titulo, valor, unidade, variacaoPct, dataReferencia, desatualizado }`.
- `app/page.tsx` (painel), `app/api/coletar/route.ts`. Vitest configurado (`@/*` alias OK).

---

## Estrutura de arquivos desta fatia

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `types/cotacao.ts` | Modificar | + `PontoHistorico`, + interface `HistoricoRepo` |
| `lib/fontes/dolar.ts` | Modificar | + `buscarHistoricoDolarBcb(dias, fetch)` |
| `lib/supabase/repo.ts` | Modificar | `supabaseRepo` passa a retornar `CotacaoRepo & HistoricoRepo` |
| `lib/backfill.ts` | Criar | `backfillHistorico(fonte, repo)` |
| `lib/grafico.ts` | Criar | `filtrarPorPeriodo(pontos, dias, agora?)` (pura) |
| `app/api/backfill/route.ts` | Criar | rota GET protegida por `CRON_SECRET` |
| `components/ui/chart.tsx` + `lib/utils.ts` + `components.json` | Criar | shadcn init + add chart |
| `components/GraficoCotacao.tsx` | Criar | `"use client"`, gráfico + toggle |
| `app/cotacao/[tipo]/page.tsx` | Criar | página de detalhe |
| `app/page.tsx` | Modificar | card vira link p/ `/cotacao/{tipo}` |
| `supabase/migrations/0002_historico_unique.sql` | Criar | constraint única |

---

## Task 1: Migration da constraint única

**Files:**
- Create: `supabase/migrations/0002_historico_unique.sql`

**Interfaces:**
- Produces: constraint `cotacoes_historico_tipo_data_unq unique (tipo, data_referencia)` (aplicada ao Supabase pelo controlador na fase final).

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0002_historico_unique.sql`:
```sql
-- Idempotência do backfill: impede pontos duplicados por dia/tipo.
alter table cotacoes_historico
  add constraint cotacoes_historico_tipo_data_unq unique (tipo, data_referencia);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_historico_unique.sql
git commit -m "feat: constraint unica (tipo, data_referencia) no historico"
```

> A aplicação no Supabase real é feita pelo controlador (MCP `apply_migration`) na fase de deploy/verificação — não há passo de banco aqui.

---

## Task 2: Tipo PontoHistorico + porta HistoricoRepo

**Files:**
- Modify: `types/cotacao.ts`
- Test: `tests/types/ponto-historico.test.ts`

**Interfaces:**
- Consumes: `Cotacao` (já existe no arquivo).
- Produces:
  ```ts
  type PontoHistorico = { data: string; valor: number };
  interface HistoricoRepo {
    salvarHistoricoEmLote(pontos: PontoHistorico[]): Promise<void>;
    historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]>;
  }
  ```

- [ ] **Step 1: Escrever o teste**

`tests/types/ponto-historico.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { PontoHistorico } from '@/types/cotacao';

describe('PontoHistorico', () => {
  it('aceita um ponto bem formado', () => {
    const p: PontoHistorico = { data: '2026-06-19T03:00:00.000Z', valor: 5.1382 };
    expect(p.valor).toBeCloseTo(5.1382);
    expect(typeof p.data).toBe('string');
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/types/ponto-historico.test.ts`
Expected: FAIL — `PontoHistorico` não exportado.

- [ ] **Step 3: Implementar (acrescentar ao final de `types/cotacao.ts`)**

```ts
export type PontoHistorico = { data: string; valor: number }; // data ISO 8601, ordem asc

export interface HistoricoRepo {
  /** Insere pontos em lote, ignorando duplicados (tipo, data_referencia). */
  salvarHistoricoEmLote(pontos: PontoHistorico[]): Promise<void>;
  /** Pontos com data_referencia >= `desde` (ISO), ordem ascendente. */
  historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]>;
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/types/ponto-historico.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/cotacao.ts tests/types/ponto-historico.test.ts
git commit -m "feat: tipo PontoHistorico e porta HistoricoRepo"
```

---

## Task 3: Fonte do histórico (BCB série)

**Files:**
- Modify: `lib/fontes/dolar.ts`
- Test: `tests/fontes/historico-dolar.test.ts`

**Interfaces:**
- Consumes: `PontoHistorico` de `@/types/cotacao`; `OFFSET_BRT` (já no arquivo).
- Produces: `buscarHistoricoDolarBcb(dias?: number, fetchImpl?: typeof fetch): Promise<PontoHistorico[]>`.

- [ ] **Step 1: Escrever os testes**

`tests/fontes/historico-dolar.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { buscarHistoricoDolarBcb } from '@/lib/fontes/dolar';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
}

describe('buscarHistoricoDolarBcb', () => {
  it('mapeia a série para PontoHistorico[] ordenado', async () => {
    const f = fakeFetch([
      { data: '17/06/2026', valor: '5.10' },
      { data: '18/06/2026', valor: '5.1613' },
    ]);
    const pts = await buscarHistoricoDolarBcb(90, f);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ data: '2026-06-17T03:00:00.000Z', valor: 5.1 });
    expect(pts[1].valor).toBeCloseTo(5.1613);
  });

  it('rejeita lista vazia', async () => {
    const f = fakeFetch([]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita item com valor não positivo', async () => {
    const f = fakeFetch([{ data: '18/06/2026', valor: '0' }]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita data em formato inesperado', async () => {
    const f = fakeFetch([{ data: '2026-06-18', valor: '5.16' }]);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch([], false);
    await expect(buscarHistoricoDolarBcb(90, f)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/fontes/historico-dolar.test.ts`
Expected: FAIL — função não exportada.

- [ ] **Step 3: Implementar (acrescentar a `lib/fontes/dolar.ts`)**

Adicionar o import do tipo no topo (junto ao import existente de `Cotacao`):
```ts
import type { Cotacao, PontoHistorico } from '@/types/cotacao';
```
E adicionar ao final do arquivo:
```ts
const urlBcbSerie = (dias: number) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/${dias}?formato=json`;

// Série histórica do dólar (PTAX diária) no BCB, para o backfill do gráfico.
export async function buscarHistoricoDolarBcb(
  dias = 90,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const res = await fetchImpl(urlBcbSerie(dias));
  if (!res.ok) throw new Error(`BCB respondeu ${res.status}`);

  const body = (await res.json()) as Array<{ data?: string; valor?: string }>;
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('Resposta do BCB inválida: série vazia');
  }

  return body.map((item) => {
    const valor = Number(item?.valor);
    const [dd, mm, yyyy] = (item?.data ?? '').split('/');
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Resposta do BCB inválida: valor ausente ou não positivo');
    }
    if (!dd || !mm || !yyyy) {
      throw new Error('Resposta do BCB inválida: data em formato inesperado');
    }
    return { data: new Date(`${yyyy}-${mm}-${dd}T00:00:00${OFFSET_BRT}`).toISOString(), valor };
  });
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/fontes/historico-dolar.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/fontes/dolar.ts tests/fontes/historico-dolar.test.ts
git commit -m "feat: fonte do historico do dolar (BCB serie)"
```

---

## Task 4: Métodos de histórico no repositório

**Files:**
- Modify: `lib/supabase/repo.ts`
- Test: `tests/supabase/repo-historico.test.ts`

**Interfaces:**
- Consumes: `Cotacao`, `CotacaoRepo`, `HistoricoRepo`, `PontoHistorico`.
- Produces: `supabaseRepo(client): CotacaoRepo & HistoricoRepo` com `salvarHistoricoEmLote` e `historicoRecente`.

- [ ] **Step 1: Escrever os testes**

`tests/supabase/repo-historico.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = [
  { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
  { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
];

describe('salvarHistoricoEmLote', () => {
  it('faz upsert ignorando duplicados', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as any;
    await supabaseRepo(client).salvarHistoricoEmLote(pontos);
    expect(client.from).toHaveBeenCalledWith('cotacoes_historico');
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'dolar', valor: 5.1, fonte: 'bcb', data_referencia: pontos[0].data }),
      ]),
      { onConflict: 'tipo,data_referencia', ignoreDuplicates: true },
    );
  });

  it('não chama o banco com lista vazia', async () => {
    const upsert = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as any;
    await supabaseRepo(client).salvarHistoricoEmLote([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('lança se o upsert retornar erro', async () => {
    const client = { from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }) } as any;
    await expect(supabaseRepo(client).salvarHistoricoEmLote(pontos)).rejects.toThrow('boom');
  });
});

describe('historicoRecente', () => {
  it('retorna pontos mapeados em ordem', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { valor: '5.10', data_referencia: '2026-06-17T03:00:00.000Z' },
        { valor: '5.1613', data_referencia: '2026-06-18T03:00:00.000Z' },
      ],
      error: null,
    });
    const client = { from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order,
    }) } as any;
    const pts = await supabaseRepo(client).historicoRecente('dolar', '2026-03-01T00:00:00.000Z');
    expect(pts).toEqual([
      { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
      { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
    ]);
  });

  it('lança em erro de leitura', async () => {
    const client = { from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    }) } as any;
    await expect(supabaseRepo(client).historicoRecente('dolar', '2026-03-01T00:00:00.000Z')).rejects.toThrow('fail');
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/supabase/repo-historico.test.ts`
Expected: FAIL — métodos inexistentes.

- [ ] **Step 3: Implementar**

Em `lib/supabase/repo.ts`, ajustar o import e a assinatura, e adicionar os dois métodos ao objeto retornado.

Import (substituir a linha de import dos tipos):
```ts
import type { Cotacao, CotacaoRepo, HistoricoRepo, PontoHistorico } from '@/types/cotacao';
```

Assinatura:
```ts
export function supabaseRepo(client: SupabaseClient): CotacaoRepo & HistoricoRepo {
```

Adicionar dentro do objeto retornado (junto de `ultimoValor`/`salvar`):
```ts
    async salvarHistoricoEmLote(pontos: PontoHistorico[]) {
      if (pontos.length === 0) return;
      const linhas = pontos.map((p) => ({
        tipo: 'dolar',
        valor: p.valor,
        fonte: 'bcb',
        data_referencia: p.data,
      }));
      const { error } = await client
        .from('cotacoes_historico')
        .upsert(linhas, { onConflict: 'tipo,data_referencia', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },

    async historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]> {
      const { data, error } = await client
        .from('cotacoes_historico')
        .select('valor, data_referencia')
        .eq('tipo', tipo)
        .gte('data_referencia', desde)
        .order('data_referencia', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ data: r.data_referencia as string, valor: Number(r.valor) }));
    },
```

- [ ] **Step 4: Rodar (passa) + suíte do repo antigo**

Run: `npx vitest run tests/supabase/`
Expected: PASS (novos + os antigos de `repo.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/repo.ts tests/supabase/repo-historico.test.ts
git commit -m "feat: repo historico (salvarHistoricoEmLote, historicoRecente)"
```

---

## Task 5: Orquestração do backfill

**Files:**
- Create: `lib/backfill.ts`
- Test: `tests/backfill.test.ts`

**Interfaces:**
- Consumes: `PontoHistorico`, `HistoricoRepo`.
- Produces: `backfillHistorico(fonte: () => Promise<PontoHistorico[]>, repo: HistoricoRepo): Promise<{ pontos: number }>`.

- [ ] **Step 1: Escrever os testes**

`tests/backfill.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { backfillHistorico } from '@/lib/backfill';
import type { HistoricoRepo, PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = [
  { data: '2026-06-17T03:00:00.000Z', valor: 5.1 },
  { data: '2026-06-18T03:00:00.000Z', valor: 5.1613 },
];

function repoMock(): HistoricoRepo {
  return { salvarHistoricoEmLote: vi.fn().mockResolvedValue(undefined), historicoRecente: vi.fn() };
}

describe('backfillHistorico', () => {
  it('grava todos os pontos e retorna a contagem', async () => {
    const repo = repoMock();
    const r = await backfillHistorico(async () => pontos, repo);
    expect(repo.salvarHistoricoEmLote).toHaveBeenCalledWith(pontos);
    expect(r).toEqual({ pontos: 2 });
  });

  it('não grava se a fonte falhar', async () => {
    const repo = repoMock();
    await expect(backfillHistorico(async () => { throw new Error('bcb fora'); }, repo)).rejects.toThrow('bcb fora');
    expect(repo.salvarHistoricoEmLote).not.toHaveBeenCalled();
  });

  it('propaga erro de escrita', async () => {
    const repo = repoMock();
    (repo.salvarHistoricoEmLote as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db fora'));
    await expect(backfillHistorico(async () => pontos, repo)).rejects.toThrow('db fora');
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/backfill.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`lib/backfill.ts`:
```ts
import type { HistoricoRepo, PontoHistorico } from '@/types/cotacao';

export async function backfillHistorico(
  fonte: () => Promise<PontoHistorico[]>,
  repo: HistoricoRepo,
): Promise<{ pontos: number }> {
  const pontos = await fonte();
  await repo.salvarHistoricoEmLote(pontos);
  return { pontos: pontos.length };
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/backfill.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/backfill.ts tests/backfill.test.ts
git commit -m "feat: orquestracao do backfill de historico"
```

---

## Task 6: Rota protegida de backfill

**Files:**
- Create: `app/api/backfill/route.ts`
- Test: `tests/api/backfill.test.ts`

**Interfaces:**
- Consumes: `buscarHistoricoDolarBcb`, `backfillHistorico`, `createServerClient`, `supabaseRepo`.
- Produces: `GET(req: Request): Promise<Response>` — 401 sem secret; 200 com `{ pontos }`; 502 em erro.

- [ ] **Step 1: Escrever os testes**

`tests/api/backfill.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/backfill', () => ({ backfillHistorico: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/dolar', () => ({ buscarHistoricoDolarBcb: vi.fn() }));

import { GET } from '@/app/api/backfill/route';
import { backfillHistorico } from '@/lib/backfill';

beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'segredo'; });

function req(auth?: string) {
  return new Request('http://localhost/api/backfill', { headers: auth ? { authorization: auth } : {} });
}

describe('GET /api/backfill', () => {
  it('401 sem o secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(backfillHistorico).not.toHaveBeenCalled();
  });

  it('200 com a contagem quando autorizado', async () => {
    (backfillHistorico as ReturnType<typeof vi.fn>).mockResolvedValue({ pontos: 90 });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pontos: 90 });
  });

  it('502 quando o backfill lança', async () => {
    (backfillHistorico as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bcb fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/api/backfill.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`app/api/backfill/route.ts`:
```ts
import { buscarHistoricoDolarBcb } from '@/lib/fontes/dolar';
import { backfillHistorico } from '@/lib/backfill';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }
  try {
    const repo = supabaseRepo(createServerClient());
    const resultado = await backfillHistorico(() => buscarHistoricoDolarBcb(90), repo);
    return Response.json(resultado);
  } catch (e) {
    console.error('falha no backfill', e);
    return new Response('erro no backfill', { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/api/backfill.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add app/api/backfill/route.ts tests/api/backfill.test.ts
git commit -m "feat: rota /api/backfill protegida"
```

---

## Task 7: Filtro de período (puro)

**Files:**
- Create: `lib/grafico.ts`
- Test: `tests/grafico.test.ts`

**Interfaces:**
- Consumes: `PontoHistorico`.
- Produces: `filtrarPorPeriodo(pontos: PontoHistorico[], dias: number, agora?: Date): PontoHistorico[]`.

- [ ] **Step 1: Escrever os testes**

`tests/grafico.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filtrarPorPeriodo } from '@/lib/grafico';
import type { PontoHistorico } from '@/types/cotacao';

const agora = new Date('2026-06-30T12:00:00.000Z');
function ponto(diasAtras: number): PontoHistorico {
  return { data: new Date(agora.getTime() - diasAtras * 86400000).toISOString(), valor: 5 + diasAtras / 100 };
}

describe('filtrarPorPeriodo', () => {
  const pontos = [ponto(89), ponto(40), ponto(20), ponto(5), ponto(1)];

  it('7d retorna só os últimos 7 dias', () => {
    expect(filtrarPorPeriodo(pontos, 7, agora)).toHaveLength(2); // 5 e 1
  });

  it('30d inclui mais que 7d e menos que 90d', () => {
    expect(filtrarPorPeriodo(pontos, 30, agora)).toHaveLength(3); // 20,5,1
  });

  it('90d retorna todos', () => {
    expect(filtrarPorPeriodo(pontos, 90, agora)).toHaveLength(5);
  });

  it('lista vazia retorna vazia', () => {
    expect(filtrarPorPeriodo([], 30, agora)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/grafico.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`lib/grafico.ts`:
```ts
import type { PontoHistorico } from '@/types/cotacao';

/** Mantém apenas os pontos dentro dos últimos `dias` a partir de `agora`. */
export function filtrarPorPeriodo(
  pontos: PontoHistorico[],
  dias: number,
  agora: Date = new Date(),
): PontoHistorico[] {
  const limite = agora.getTime() - dias * 24 * 60 * 60 * 1000;
  return pontos.filter((p) => new Date(p.data).getTime() >= limite);
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/grafico.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/grafico.ts tests/grafico.test.ts
git commit -m "feat: filtrarPorPeriodo (filtro puro do grafico)"
```

---

## Task 8: Setup shadcn/ui + componente Chart

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/chart.tsx` (e ajustes em `globals.css`/config conforme o shadcn)
- Modify: `package.json` (dep `recharts` e libs do shadcn)

**Interfaces:**
- Produces: componentes shadcn de chart disponíveis (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, type `ChartConfig`) e `cn()` em `@/lib/utils`.

> Tarefa de setup. Sensível a ambiente (Tailwind v3 vs v4). Rodar **não-interativo** e verificar que o painel atual continua intacto.

- [ ] **Step 1: Detectar a versão do Tailwind**

Run: `npm ls tailwindcss`
Anote se é v3 ou v4 (muda a config do shadcn). O `shadcn init` se adapta, mas a verificação evita surpresa.

- [ ] **Step 2: Inicializar o shadcn (não-interativo)**

Run: `npx shadcn@latest init -d -y`
(Se `-d/-y` não forem aceitos na versão instalada, usar as flags equivalentes de defaults/sim sem prompts; nunca deixar prompt interativo aberto.)
Expected: cria `components.json`, `lib/utils.ts`, ajusta `globals.css` com as variáveis de tema. Preserva o conteúdo Tailwind existente.

- [ ] **Step 3: Adicionar o componente chart**

Run: `npx shadcn@latest add chart -y`
Expected: cria `components/ui/chart.tsx` e instala `recharts`.

- [ ] **Step 4: Verificar build e testes**

Run: `npm run build`
Expected: build conclui sem erro e sem warnings novos.
Run: `npm test`
Expected: toda a suíte existente continua passando.

- [ ] **Step 5: Conferir o painel atual**

Confirmar que `app/page.tsx` ainda compila e o tema não quebrou (inspecionar `globals.css`: as diretivas/imports do Tailwind originais devem continuar presentes além das variáveis do shadcn).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: setup shadcn/ui + componente chart (recharts)"
```

---

## Task 9: Componente GraficoCotacao

**Files:**
- Create: `components/GraficoCotacao.tsx`
- Test: `tests/components/GraficoCotacao.test.tsx`

**Interfaces:**
- Consumes: `PontoHistorico`; `filtrarPorPeriodo` de `@/lib/grafico`; shadcn chart (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig`); `recharts` (`LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`).
- Produces: `GraficoCotacao({ pontos }: { pontos: PontoHistorico[] }): JSX.Element` com toggle 7/30/90 (default 30).

- [ ] **Step 1: Escrever o teste (smoke + toggle)**

`tests/components/GraficoCotacao.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import type { PontoHistorico } from '@/types/cotacao';

const pontos: PontoHistorico[] = Array.from({ length: 40 }, (_, i) => ({
  data: new Date(Date.now() - (40 - i) * 86400000).toISOString(),
  valor: 5 + i / 100,
}));

describe('GraficoCotacao', () => {
  it('renderiza os botões de período', () => {
    render(<GraficoCotacao pontos={pontos} />);
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('renderiza sem quebrar mesmo com poucos pontos', () => {
    render(<GraficoCotacao pontos={pontos.slice(-1)} />);
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run tests/components/GraficoCotacao.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`components/GraficoCotacao.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { filtrarPorPeriodo } from '@/lib/grafico';
import type { PontoHistorico } from '@/types/cotacao';

const PERIODOS = [7, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number];

const config = {
  valor: { label: 'Dólar (R$)', color: 'hsl(142 71% 45%)' },
} satisfies ChartConfig;

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function GraficoCotacao({ pontos }: { pontos: PontoHistorico[] }) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const dados = useMemo(
    () =>
      filtrarPorPeriodo(pontos, periodo).map((p) => ({
        rotulo: fmtData.format(new Date(p.data)),
        valor: p.valor,
      })),
    [pontos, periodo],
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodo(p)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              periodo === p ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {dados.length === 0 ? (
        <p className="text-sm text-neutral-500">Sem dados neste período.</p>
      ) : (
        <ChartContainer config={config} className="h-[280px] w-full">
          <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="valor" type="monotone" stroke="var(--color-valor)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run tests/components/GraficoCotacao.test.tsx`
Expected: PASS — 2 testes. (Recharts pode emitir aviso de dimensão no jsdom; o `ResponsiveContainer` do `ChartContainer` renderiza sem quebrar — os botões existem.)

- [ ] **Step 5: Commit**

```bash
git add components/GraficoCotacao.tsx tests/components/GraficoCotacao.test.tsx
git commit -m "feat: componente GraficoCotacao com toggle de periodo"
```

---

## Task 10: Página de detalhe + link no painel

**Files:**
- Create: `app/cotacao/[tipo]/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `createPublicClient`, `supabaseRepo` (`historicoRecente`), `CardCotacao`, `GraficoCotacao`.
- Produces: rota `/cotacao/[tipo]`; card do painel linka para `/cotacao/{tipo}`.

- [ ] **Step 1: Implementar a página de detalhe**

`app/cotacao/[tipo]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { supabaseRepo } from '@/lib/supabase/repo';
import { CardCotacao } from '@/components/CardCotacao';
import { GraficoCotacao } from '@/components/GraficoCotacao';

export const dynamic = 'force-dynamic';

const TITULOS: Record<string, string> = { dolar: 'Dólar' };
const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
const JANELA_DIAS = 90;

export default async function DetalheCotacao({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const supabase = createPublicClient();

  const { data: atual } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia')
    .eq('tipo', tipo)
    .maybeSingle();

  if (!atual) notFound();

  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const pontos = await supabaseRepo(supabase).historicoRecente(tipo, desde);
  const titulo = TITULOS[tipo] ?? tipo;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <a href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</a>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{titulo}</h1>

      <div className="mt-6 max-w-sm">
        <CardCotacao
          titulo={titulo}
          valor={Number(atual.valor)}
          unidade={atual.unidade}
          variacaoPct={atual.variacao_pct === null ? null : Number(atual.variacao_pct)}
          dataReferencia={atual.data_referencia}
          desatualizado={Date.now() - new Date(atual.data_referencia).getTime() > DOIS_DIAS_MS}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Tendência</h2>
        {pontos.length === 0 ? (
          <p className="text-neutral-500">Sem histórico ainda.</p>
        ) : (
          <GraficoCotacao pontos={pontos} />
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Linkar o card no painel**

Em `app/page.tsx`, envolver cada `<CardCotacao .../>` num link para a página de detalhe. Substituir o bloco do `data?.map(...)` por:
```tsx
        {data?.map((c) => (
          <a key={c.tipo} href={`/cotacao/${c.tipo}`} className="block transition hover:opacity-90">
            <CardCotacao
              titulo={TITULOS[c.tipo] ?? c.tipo}
              valor={Number(c.valor)}
              unidade={c.unidade}
              variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
              dataReferencia={c.data_referencia}
              desatualizado={Date.now() - new Date(c.data_referencia).getTime() > DOIS_DIAS_MS}
            />
          </a>
        ))}
```
(O `key` migra do `CardCotacao` para o `<a>` que o envolve.)

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.
Run: `npm run build`
Expected: build limpo; rotas `/`, `/cotacao/[tipo]`, `/api/coletar`, `/api/backfill` listadas.

- [ ] **Step 4: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/cotacao/[tipo]/page.tsx app/page.tsx
git commit -m "feat: pagina de detalhe /cotacao/[tipo] com grafico + link no painel"
```

---

## Task 11: Aplicar migration, deploy e verificação e2e (controlador)

> Executada pelo controlador (acesso a Supabase MCP, Vercel CLI e push). Não é uma tarefa de subagente.

- [ ] **Step 1: Aplicar a migration 0002 no Supabase** (MCP `apply_migration`, conteúdo de `0002_historico_unique.sql`). Confirmar a constraint via `list_migrations`/`execute_sql`.
- [ ] **Step 2: Push do branch** → auto-deploy na Vercel (repo conectado).
- [ ] **Step 3: Aguardar o deploy** ficar `Ready`.
- [ ] **Step 4: Rodar o backfill em produção**: `GET /api/backfill` com `Authorization: Bearer ${CRON_SECRET}`. Esperado: `{ "pontos": ~60-90 }`.
- [ ] **Step 5: Conferir no Supabase**: `select count(*) from cotacoes_historico` cresceu para ~dezenas; nenhuma duplicata (tipo, data_referencia).
- [ ] **Step 6: Conferir a página**: `GET /cotacao/dolar` renderiza o card + o gráfico; o painel `/` linka para ela.
- [ ] **Step 7: Re-rodar o backfill** uma vez e confirmar idempotência (contagem não duplica).

---

## Self-review (cobertura do spec)

1. Backfill BCB ~90d → Tasks 3, 5, 6, 11. ✅
2. Constraint única / idempotência → Tasks 1, 4 (`ignoreDuplicates`), 11. ✅
3. shadcn Chart → Tasks 8, 9. ✅
4. Página `/cotacao/[tipo]` + toggle 7/30/90 → Tasks 9, 10. ✅
5. Link do painel → Task 10. ✅
6. Testes + build → Tasks 2–10; deploy/e2e → Task 11. ✅
7. Tipos consistentes: `PontoHistorico`, `HistoricoRepo`, `buscarHistoricoDolarBcb`, `backfillHistorico`, `salvarHistoricoEmLote`, `historicoRecente`, `filtrarPorPeriodo`, `GraficoCotacao` — usados de forma idêntica entre tarefas. ✅
