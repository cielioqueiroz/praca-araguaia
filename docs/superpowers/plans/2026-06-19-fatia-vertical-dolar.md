# Fatia Vertical Fina — Cotação do Dólar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar a arquitetura coleta → banco → painel da Praça Araguaia exibindo a cotação do dólar, coletada por rota agendada e gravada no Supabase com histórico.

**Architecture:** Next.js 15 (App Router) full-stack. Uma rota agendada (`/api/coletar`) busca o dólar numa API pública, calcula a variação contra o último valor e grava em `cotacoes` (upsert) + `cotacoes_historico` (insert) via service role. A página inicial é um Server Component que lê do Supabase com a anon key (RLS pública só de leitura). A fonte de dados é desacoplada da orquestração para que novas cotações (boi, soja) sejam só um novo arquivo `fontes/*.ts`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@supabase/supabase-js`, Vitest, Vercel Cron.

## Global Constraints

- Next.js **15** (App Router), TypeScript strict, Tailwind CSS.
- Dinheiro sempre em `numeric` no banco e `number` no código — nunca string para cálculo.
- Service role key **só no servidor**, nunca em código client ou `NEXT_PUBLIC_*`.
- Fonte primária do dólar: **AwesomeAPI** `https://economia.awesomeapi.com.br/last/USD-BRL` (sem auth).
- A coleta nunca grava dado inválido: valor numérico `> 0` e data presente são obrigatórios.
- RLS ativa nas duas tabelas desde a criação: `SELECT` público, escrita só service role.
- Commits frequentes, um por tarefa concluída.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `types/cotacao.ts` | Tipo `Cotacao` + interface `CotacaoRepo` (porta de persistência) |
| `lib/fontes/dolar.ts` | `buscarDolar()` — busca e valida o dólar na AwesomeAPI |
| `lib/coleta.ts` | `coletarCotacao()` — orquestração pura: fonte + repo, calcula variação |
| `lib/supabase/server.ts` | `createServerClient()` — client service role (só server) |
| `lib/supabase/public.ts` | `createPublicClient()` — client anon (leitura) |
| `lib/supabase/repo.ts` | `supabaseRepo()` — implementação de `CotacaoRepo` sobre supabase-js |
| `app/api/coletar/route.ts` | Handler GET: valida `CRON_SECRET`, roda coleta |
| `components/CardCotacao.tsx` | Apresentação pura de uma cotação |
| `app/page.tsx` | Server Component: lê cotações, monta painel |
| `supabase/migrations/0001_cotacoes.sql` | DDL + RLS |
| `vercel.json` | Cron 1×/dia → `/api/coletar` |

---

## Task 1: Scaffold do projeto + ferramentas

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `vitest.config.ts`, `.env.local.example`, `.gitignore` (já existe — ajustar se preciso)
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: projeto Next.js 15 que builda; `npm test` rodando Vitest.

- [ ] **Step 1: Inicializar o Next.js 15 com TypeScript e Tailwind**

Run (na raiz `d:/Projetos_Programacao/agro_app`, que já tem arquivos — usar `.`):
```bash
npx create-next-app@latest . --ts --tailwind --app --no-src-dir --eslint --import-alias "@/*" --use-npm --no-turbopack
```
Quando perguntar sobre sobrescrever arquivos existentes, manter `conceito-praca-araguaia.md`, `docs/` e `.git/`. Se o comando recusar por diretório não-vazio, gerar em pasta temporária e copiar, preservando `docs/`, `.git/`, `conceito-praca-araguaia.md`.

- [ ] **Step 2: Instalar dependências de runtime e teste**

```bash
npm install @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
});
```

- [ ] **Step 4: Criar `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Adicionar script de teste ao `package.json`**

No bloco `"scripts"`, adicionar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Criar `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

- [ ] **Step 7: Escrever o smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('o ambiente de teste roda', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Rodar o smoke test (deve passar)**

Run: `npm test`
Expected: PASS — 1 teste passando.

- [ ] **Step 9: Garantir que o build funciona**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js 15 + tailwind + vitest"
```

---

## Task 2: Migration do banco (schema + RLS)

**Files:**
- Create: `supabase/migrations/0001_cotacoes.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `cotacoes` e `cotacoes_historico` com RLS; aplicadas no projeto Supabase.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0001_cotacoes.sql`:
```sql
-- Último valor "vivo" por tipo (1 linha por tipo).
create table cotacoes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null unique,
  valor           numeric(12,4) not null,
  unidade         text not null,
  variacao_pct    numeric(6,2),
  fonte           text not null,
  data_referencia timestamptz not null,
  atualizado_em   timestamptz not null default now()
);

-- Série temporal append-only.
create table cotacoes_historico (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,
  valor           numeric(12,4) not null,
  fonte           text not null,
  data_referencia timestamptz not null,
  created_at      timestamptz not null default now()
);
create index cotacoes_historico_tipo_data_idx
  on cotacoes_historico (tipo, data_referencia desc);

-- RLS: leitura pública, escrita só service role (que ignora RLS).
alter table cotacoes enable row level security;
alter table cotacoes_historico enable row level security;

create policy "cotacoes leitura publica"
  on cotacoes for select to anon using (true);
create policy "historico leitura publica"
  on cotacoes_historico for select to anon using (true);
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Criar o projeto Supabase (via Supabase MCP `create_project` ou painel) e aplicar a migration (MCP `apply_migration` com o conteúdo do arquivo, ou colar no SQL Editor).

- [ ] **Step 3: Verificar as tabelas e RLS**

Via MCP `list_tables` (ou painel): confirmar que `cotacoes` e `cotacoes_historico` existem e têm `rls_enabled = true`.
Expected: ambas presentes, RLS ativa, 2 policies de select.

- [ ] **Step 4: Preencher `.env.local`**

Copiar `.env.local.example` para `.env.local` e preencher `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (do painel Supabase) e gerar um `CRON_SECRET` aleatório.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_cotacoes.sql
git commit -m "feat: migration cotacoes + cotacoes_historico com RLS"
```

---

## Task 3: Tipo Cotacao + porta do repositório

**Files:**
- Create: `types/cotacao.ts`
- Test: `tests/types/cotacao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  type Cotacao = { tipo: string; valor: number; unidade: string; fonte: string; dataReferencia: string };
  type CotacaoSalva = Cotacao & { variacaoPct: number | null };
  interface CotacaoRepo {
    ultimoValor(tipo: string): Promise<number | null>;
    salvar(cotacao: Cotacao, variacaoPct: number | null): Promise<void>;
  }
  ```

- [ ] **Step 1: Escrever o teste de tipo (compila e aceita o shape esperado)**

`tests/types/cotacao.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Cotacao, CotacaoSalva } from '@/types/cotacao';

describe('Cotacao', () => {
  it('aceita um objeto bem formado', () => {
    const c: Cotacao = {
      tipo: 'dolar', valor: 5.43, unidade: 'R$',
      fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
    };
    const salva: CotacaoSalva = { ...c, variacaoPct: 1.2 };
    expect(salva.tipo).toBe('dolar');
    expect(salva.variacaoPct).toBe(1.2);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar — módulo inexistente)**

Run: `npx vitest run tests/types/cotacao.test.ts`
Expected: FAIL — cannot find module `@/types/cotacao`.

- [ ] **Step 3: Implementar o tipo**

`types/cotacao.ts`:
```ts
export type Cotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  fonte: string;
  dataReferencia: string; // ISO 8601
};

export type CotacaoSalva = Cotacao & { variacaoPct: number | null };

export interface CotacaoRepo {
  /** Último valor gravado para o tipo, ou null se ainda não há histórico. */
  ultimoValor(tipo: string): Promise<number | null>;
  /** Faz upsert em cotacoes e insert em cotacoes_historico. */
  salvar(cotacao: Cotacao, variacaoPct: number | null): Promise<void>;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/types/cotacao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/cotacao.ts tests/types/cotacao.test.ts
git commit -m "feat: tipo Cotacao e porta CotacaoRepo"
```

---

## Task 4: Fonte do dólar (AwesomeAPI)

**Files:**
- Create: `lib/fontes/dolar.ts`
- Test: `tests/fontes/dolar.test.ts`

**Interfaces:**
- Consumes: `Cotacao` de `@/types/cotacao`.
- Produces: `buscarDolar(fetchImpl?: typeof fetch): Promise<Cotacao>` (tipo `'dolar'`, unidade `'R$'`, fonte `'awesomeapi'`).

A AwesomeAPI responde:
```json
{ "USDBRL": { "bid": "5.4321", "create_date": "2026-06-19 09:00:00", "code": "USD" } }
```

- [ ] **Step 1: Escrever os testes**

`tests/fontes/dolar.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { buscarDolar } from '@/lib/fontes/dolar';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('buscarDolar', () => {
  it('mapeia uma resposta válida para Cotacao', async () => {
    const f = fakeFetch({ USDBRL: { bid: '5.4321', create_date: '2026-06-19 09:00:00' } });
    const c = await buscarDolar(f);
    expect(c.tipo).toBe('dolar');
    expect(c.valor).toBeCloseTo(5.4321);
    expect(c.unidade).toBe('R$');
    expect(c.fonte).toBe('awesomeapi');
    expect(typeof c.dataReferencia).toBe('string');
  });

  it('rejeita valor zero ou negativo', async () => {
    const f = fakeFetch({ USDBRL: { bid: '0', create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolar(f)).rejects.toThrow();
  });

  it('rejeita resposta sem o campo bid', async () => {
    const f = fakeFetch({ USDBRL: { create_date: '2026-06-19 09:00:00' } });
    await expect(buscarDolar(f)).rejects.toThrow();
  });

  it('rejeita quando a resposta HTTP não é ok', async () => {
    const f = fakeFetch({}, false);
    await expect(buscarDolar(f)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run tests/fontes/dolar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar a fonte**

`lib/fontes/dolar.ts`:
```ts
import type { Cotacao } from '@/types/cotacao';

const URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';

export async function buscarDolar(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(URL);
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const body = (await res.json()) as { USDBRL?: { bid?: string; create_date?: string } };
  const raw = body?.USDBRL;
  const valor = Number(raw?.bid);

  if (!raw || !Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta da AwesomeAPI inválida: bid ausente ou não positivo');
  }
  if (!raw.create_date) {
    throw new Error('Resposta da AwesomeAPI inválida: create_date ausente');
  }

  return {
    tipo: 'dolar',
    valor,
    unidade: 'R$',
    fonte: 'awesomeapi',
    dataReferencia: new Date(raw.create_date.replace(' ', 'T')).toISOString(),
  };
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run tests/fontes/dolar.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/fontes/dolar.ts tests/fontes/dolar.test.ts
git commit -m "feat: fonte do dolar via AwesomeAPI com validacao"
```

---

## Task 5: Orquestração da coleta

**Files:**
- Create: `lib/coleta.ts`
- Test: `tests/coleta.test.ts`

**Interfaces:**
- Consumes: `Cotacao`, `CotacaoSalva`, `CotacaoRepo` de `@/types/cotacao`.
- Produces: `coletarCotacao(fonte: () => Promise<Cotacao>, repo: CotacaoRepo): Promise<CotacaoSalva>`.

Regra da variação: se `ultimoValor` é `null` → `variacaoPct = null`. Senão `((novo - anterior)/anterior)*100`, arredondado a 2 casas.

- [ ] **Step 1: Escrever os testes**

`tests/coleta.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { coletarCotacao } from '@/lib/coleta';
import type { Cotacao, CotacaoRepo } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.50, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

function repoMock(ultimo: number | null): CotacaoRepo {
  return {
    ultimoValor: vi.fn().mockResolvedValue(ultimo),
    salvar: vi.fn().mockResolvedValue(undefined),
  };
}

describe('coletarCotacao', () => {
  it('calcula a variação percentual contra o último valor', async () => {
    const repo = repoMock(5.00);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeCloseTo(10); // (5.5-5)/5 = 10%
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, expect.closeTo(10, 2));
  });

  it('variação nula na primeira coleta (sem histórico)', async () => {
    const repo = repoMock(null);
    const r = await coletarCotacao(async () => cotacao, repo);
    expect(r.variacaoPct).toBeNull();
    expect(repo.salvar).toHaveBeenCalledWith(cotacao, null);
  });

  it('não grava se a fonte falhar', async () => {
    const repo = repoMock(5.00);
    await expect(
      coletarCotacao(async () => { throw new Error('fonte fora'); }, repo)
    ).rejects.toThrow('fonte fora');
    expect(repo.salvar).not.toHaveBeenCalled();
  });

  it('propaga erro de escrita', async () => {
    const repo = repoMock(5.00);
    (repo.salvar as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db fora'));
    await expect(coletarCotacao(async () => cotacao, repo)).rejects.toThrow('db fora');
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run tests/coleta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar a orquestração**

`lib/coleta.ts`:
```ts
import type { Cotacao, CotacaoSalva, CotacaoRepo } from '@/types/cotacao';

export async function coletarCotacao(
  fonte: () => Promise<Cotacao>,
  repo: CotacaoRepo,
): Promise<CotacaoSalva> {
  const cotacao = await fonte();
  const anterior = await repo.ultimoValor(cotacao.tipo);

  const variacaoPct =
    anterior === null || anterior === 0
      ? null
      : Math.round(((cotacao.valor - anterior) / anterior) * 100 * 100) / 100;

  await repo.salvar(cotacao, variacaoPct);
  return { ...cotacao, variacaoPct };
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run tests/coleta.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/coleta.ts tests/coleta.test.ts
git commit -m "feat: orquestracao da coleta com calculo de variacao"
```

---

## Task 6: Clients e repositório Supabase

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/public.ts`, `lib/supabase/repo.ts`
- Test: `tests/supabase/repo.test.ts`

**Interfaces:**
- Consumes: `Cotacao`, `CotacaoRepo`; `@supabase/supabase-js`.
- Produces:
  - `createServerClient(): SupabaseClient` (service role)
  - `createPublicClient(): SupabaseClient` (anon)
  - `supabaseRepo(client: SupabaseClient): CotacaoRepo`

- [ ] **Step 1: Escrever o teste do repositório (com client fake)**

`tests/supabase/repo.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { supabaseRepo } from '@/lib/supabase/repo';
import type { Cotacao } from '@/types/cotacao';

const cotacao: Cotacao = {
  tipo: 'dolar', valor: 5.5, unidade: 'R$',
  fonte: 'awesomeapi', dataReferencia: '2026-06-19T12:00:00.000Z',
};

describe('supabaseRepo.ultimoValor', () => {
  it('retorna o valor do registro mais recente', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { valor: 5.0 }, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar')).toBe(5.0);
  });

  it('retorna null quando não há histórico', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    expect(await repo.ultimoValor('dolar')).toBeNull();
  });
});

describe('supabaseRepo.salvar', () => {
  it('faz upsert em cotacoes e insert em historico', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === 'cotacoes' ? { upsert } : { insert },
      ),
    } as any;
    const repo = supabaseRepo(client);
    await repo.salvar(cotacao, 10);
    expect(upsert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledOnce();
  });

  it('lança se o upsert retornar erro', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
      }),
    } as any;
    const repo = supabaseRepo(client);
    await expect(repo.salvar(cotacao, 10)).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run tests/supabase/repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar os clients**

`lib/supabase/server.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

`lib/supabase/public.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createPublicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public env ausente');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 4: Implementar o repositório**

`lib/supabase/repo.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cotacao, CotacaoRepo } from '@/types/cotacao';

export function supabaseRepo(client: SupabaseClient): CotacaoRepo {
  return {
    async ultimoValor(tipo) {
      const { data, error } = await client
        .from('cotacoes_historico')
        .select('valor')
        .eq('tipo', tipo)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? Number(data.valor) : null;
    },

    async salvar(cotacao: Cotacao, variacaoPct) {
      const up = await client.from('cotacoes').upsert(
        {
          tipo: cotacao.tipo,
          valor: cotacao.valor,
          unidade: cotacao.unidade,
          variacao_pct: variacaoPct,
          fonte: cotacao.fonte,
          data_referencia: cotacao.dataReferencia,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tipo' },
      );
      if (up.error) throw new Error(up.error.message);

      const ins = await client.from('cotacoes_historico').insert({
        tipo: cotacao.tipo,
        valor: cotacao.valor,
        fonte: cotacao.fonte,
        data_referencia: cotacao.dataReferencia,
      });
      if (ins.error) throw new Error(ins.error.message);
    },
  };
}
```

- [ ] **Step 5: Rodar os testes (devem passar)**

Run: `npx vitest run tests/supabase/repo.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase tests/supabase
git commit -m "feat: clients supabase (server/public) e CotacaoRepo"
```

---

## Task 7: Rota de coleta protegida

**Files:**
- Create: `app/api/coletar/route.ts`
- Test: `tests/api/coletar.test.ts`

**Interfaces:**
- Consumes: `buscarDolar`, `coletarCotacao`, `createServerClient`, `supabaseRepo`.
- Produces: `GET(req: Request): Promise<Response>` — 401 sem `Bearer ${CRON_SECRET}`; 200 com resultado JSON; 502 se a coleta falhar.

Nota: Vercel Cron envia GET e adiciona automaticamente `Authorization: Bearer ${CRON_SECRET}` quando a env `CRON_SECRET` existe.

- [ ] **Step 1: Escrever os testes**

`tests/api/coletar.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/coleta', () => ({ coletarCotacao: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/repo', () => ({ supabaseRepo: vi.fn(() => ({})) }));
vi.mock('@/lib/fontes/dolar', () => ({ buscarDolar: vi.fn() }));

import { GET } from '@/app/api/coletar/route';
import { coletarCotacao } from '@/lib/coleta';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'segredo';
});

function req(auth?: string) {
  return new Request('http://localhost/api/coletar', {
    headers: auth ? { authorization: auth } : {},
  });
}

describe('GET /api/coletar', () => {
  it('401 sem o secret correto', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(coletarCotacao).not.toHaveBeenCalled();
  });

  it('200 e resultado quando autorizado e a coleta funciona', async () => {
    (coletarCotacao as ReturnType<typeof vi.fn>).mockResolvedValue({
      tipo: 'dolar', valor: 5.5, unidade: 'R$', fonte: 'awesomeapi',
      dataReferencia: '2026-06-19T12:00:00.000Z', variacaoPct: 1.1,
    });
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tipo).toBe('dolar');
  });

  it('502 quando a coleta lança', async () => {
    (coletarCotacao as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fonte fora'));
    const res = await GET(req('Bearer segredo'));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run tests/api/coletar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar a rota**

`app/api/coletar/route.ts`:
```ts
import { buscarDolar } from '@/lib/fontes/dolar';
import { coletarCotacao } from '@/lib/coleta';
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
    const resultado = await coletarCotacao(buscarDolar, repo);
    return Response.json(resultado);
  } catch (e) {
    console.error('falha na coleta', e);
    return new Response('erro na coleta', { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run tests/api/coletar.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add app/api/coletar/route.ts tests/api/coletar.test.ts
git commit -m "feat: rota /api/coletar protegida por CRON_SECRET"
```

---

## Task 8: Componente CardCotacao

**Files:**
- Create: `components/CardCotacao.tsx`
- Test: `tests/components/CardCotacao.test.tsx`

**Interfaces:**
- Consumes: nada (apresentação pura).
- Produces:
  ```ts
  type CardCotacaoProps = {
    titulo: string; valor: number; unidade: string;
    variacaoPct: number | null; dataReferencia: string; desatualizado: boolean;
  };
  function CardCotacao(props: CardCotacaoProps): JSX.Element
  ```

- [ ] **Step 1: Escrever os testes**

`tests/components/CardCotacao.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardCotacao } from '@/components/CardCotacao';

describe('CardCotacao', () => {
  it('mostra título e valor formatado', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={1.2} dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} />
    );
    expect(screen.getByText('Dólar')).toBeInTheDocument();
    expect(screen.getByText(/5,43/)).toBeInTheDocument();
  });

  it('marca como desatualizado quando a flag está ligada', () => {
    render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$"
        variacaoPct={null} dataReferencia="2026-06-10T12:00:00.000Z" desatualizado={true} />
    );
    expect(screen.getByText(/desatualizado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run tests/components/CardCotacao.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar o componente**

`components/CardCotacao.tsx`:
```tsx
export type CardCotacaoProps = {
  titulo: string;
  valor: number;
  unidade: string;
  variacaoPct: number | null;
  dataReferencia: string;
  desatualizado: boolean;
};

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function CardCotacao({ titulo, valor, unidade, variacaoPct, dataReferencia, desatualizado }: CardCotacaoProps) {
  const subiu = (variacaoPct ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{titulo}</h2>
      <p className="mt-2 text-4xl font-bold text-neutral-900">
        {unidade} {fmtValor.format(valor)}
      </p>
      {variacaoPct !== null && (
        <p className={`mt-1 text-sm font-medium ${subiu ? 'text-emerald-600' : 'text-red-600'}`}>
          {subiu ? '▲' : '▼'} {Math.abs(variacaoPct).toLocaleString('pt-BR')}%
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        {fmtData.format(new Date(dataReferencia))}
        {desatualizado && <span className="ml-2 font-semibold text-amber-600">desatualizado</span>}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run tests/components/CardCotacao.test.tsx`
Expected: PASS — 2 testes.

- [ ] **Step 5: Commit**

```bash
git add components/CardCotacao.tsx tests/components/CardCotacao.test.tsx
git commit -m "feat: componente CardCotacao"
```

---

## Task 9: Página do painel

**Files:**
- Create: `app/page.tsx`
- Modify: `app/layout.tsx` (título/metadata), `app/globals.css` (se necessário)

**Interfaces:**
- Consumes: `createPublicClient`, `CardCotacao`.
- Produces: rota `/` que lê `cotacoes` e renderiza o painel; estado vazio explícito.

- [ ] **Step 1: Implementar a página (Server Component)**

`app/page.tsx`:
```tsx
import { createPublicClient } from '@/lib/supabase/public';
import { CardCotacao } from '@/components/CardCotacao';

export const dynamic = 'force-dynamic';

const TITULOS: Record<string, string> = { dolar: 'Dólar' };
const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;

export default async function Home() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-900">Praça Araguaia — Cotações</h1>
      <p className="mt-1 text-sm text-neutral-500">Fonte de referência diária do produtor.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {error && <p className="text-red-600">Erro ao carregar cotações.</p>}
        {!error && (!data || data.length === 0) && (
          <p className="text-neutral-500">Ainda sem cotação — rode a coleta (/api/coletar).</p>
        )}
        {data?.map((c) => (
          <CardCotacao
            key={c.tipo}
            titulo={TITULOS[c.tipo] ?? c.tipo}
            valor={Number(c.valor)}
            unidade={c.unidade}
            variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
            dataReferencia={c.data_referencia}
            desatualizado={Date.now() - new Date(c.data_referencia).getTime() > DOIS_DIAS_MS}
          />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Ajustar o metadata em `app/layout.tsx`**

Trocar o objeto `metadata` exportado por:
```ts
export const metadata = {
  title: 'Praça Araguaia — Cotações',
  description: 'Cotações diárias para o produtor rural do Araguaia.',
};
```

- [ ] **Step 3: Rodar o app e checar a tela**

Run: `npm run dev` e abrir `http://localhost:3000`.
Expected: título do painel + estado vazio ("Ainda sem cotação") já que o banco está vazio.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: painel de cotacoes com estado vazio"
```

---

## Task 10: Cron da Vercel + verificação ponta a ponta

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: rota `/api/coletar`.
- Produces: agendamento diário; fluxo completo verificado.

- [ ] **Step 1: Criar `vercel.json`**

`vercel.json` (11:00 UTC ≈ 08:00 BRT):
```json
{
  "crons": [
    { "path": "/api/coletar", "schedule": "0 11 * * *" }
  ]
}
```

- [ ] **Step 2: Smoke test local da coleta (contra a API real)**

Com `.env.local` preenchido e `npm run dev` rodando, chamar a rota com o secret:
```bash
curl -s -H "authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/coletar
```
Expected: JSON `{ "tipo": "dolar", "valor": <numero>, ... }`, status 200.

- [ ] **Step 3: Confirmar gravação no Supabase**

Via MCP `execute_sql` ou painel: `select * from cotacoes; select count(*) from cotacoes_historico;`
Expected: 1 linha em `cotacoes` (tipo `dolar`), ≥1 linha no histórico.

- [ ] **Step 4: Confirmar exibição na tela**

Recarregar `http://localhost:3000`.
Expected: o card do dólar aparece com valor, variação (nula na primeira coleta) e data.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add vercel.json
git commit -m "feat: agendamento vercel cron da coleta diaria"
```

- [ ] **Step 7 (opcional): Deploy na Vercel**

Conectar o repositório à Vercel, definir as env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) e fazer o deploy. A Vercel adiciona o header `Authorization: Bearer ${CRON_SECRET}` automaticamente nas chamadas do cron.

---

## Critérios de sucesso (da spec)

1. `npm run dev` sobe o app sem erros. → Task 1, 9
2. Migrations criam as tabelas com RLS no Supabase. → Task 2
3. `/api/coletar` com `CRON_SECRET` grava/atualiza o dólar + histórico. → Task 7, 10
4. A página `/` mostra valor atual, variação e data. → Task 9, 10
5. Testes unitários passam. → Tasks 3–8, 10
6. Vercel Cron configurado 1×/dia. → Task 10
