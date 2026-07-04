# Termômetro da Praça T1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reporte anônimo de preços locais (`/termometro/reportar` → `POST /api/reportar`, moderação via dashboard) e médias 7d dos aprovados em `/termometro`, com item no header.

**Architecture:** Lógica pura em `lib/termometro.ts` (produtos/faixas, validação, agregação); rota de escrita com service role (tabela sem INSERT público — RLS só libera SELECT de aprovados); páginas no visual do redesign (tokens papel/linha/tinta/mata/pasto).

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Supabase (RLS + service role), Vitest + Testing Library. Zero dependências novas.

**Spec:** `docs/superpowers/specs/2026-07-03-termometro-t1-design.md`

## Global Constraints

- TypeScript **strict**; **zero dependências novas**; textos de UI em pt-BR simples (público rural, celular).
- Produtos e faixas plausíveis (R$): boi 150–600 (R$/@), bezerro 800–6000 (R$/cabeça), vaca 130–550 (R$/@), soja 40–300 (R$/sc 60kg), milho 20–200 (R$/sc 60kg). Ordem de exibição: boi, bezerro, vaca, soja, milho.
- Municípios: exatamente os nomes de `MUNICIPIOS` de `lib/fontes/chuva.ts` (Redenção, Santana do Araguaia, Vila Rica, Confresa, São Félix do Araguaia).
- Honeypot: campo `contato` — preenchido ⇒ responder **200 como sucesso** e não gravar.
- Limite: **5 reportes por `ip_hash` por 24h** ⇒ 429 "Limite diário atingido — tente amanhã."
- `ip_hash` = SHA-256 hex do primeiro IP de `x-forwarded-for` (ou `'desconhecido'`); nunca gravar IP puro.
- Visual: tokens do redesign (`bg-papel`, `border-linha`, `text-tinta/*`, `text-mata`, `bg-pasto`, `font-display`); estilo dos cards existentes.
- Testes: Vitest, `describe/it` em pt-BR. **NUNCA rode `git push` antes da Task 4** (deploy precisa de aprovação do usuário). A migração é aplicada na Task 4 (não tente aplicar antes).

---

### Task 1: Migração + lógica pura (`lib/termometro.ts`)

**Files:**
- Create: `supabase/migrations/0003_reportes.sql`
- Create: `lib/termometro.ts`
- Test: `tests/termometro.test.ts`

**Interfaces:**
- Consumes: `MUNICIPIOS` de `@/lib/fontes/chuva` (nomes).
- Produces (Tasks 2–3 consomem):
  - `type ProdutoTermometro = 'boi' | 'bezerro' | 'vaca' | 'soja' | 'milho'`
  - `PRODUTOS: Record<ProdutoTermometro, { rotulo: string; unidade: string; min: number; max: number }>`
  - `ORDEM_PRODUTOS: ProdutoTermometro[]`
  - `MUNICIPIOS_TERMOMETRO: string[]`
  - `validarReporte(body: unknown) → { tipo: 'honeypot' } | { tipo: 'invalido'; erro: string } | { tipo: 'valido'; reporte: { produto, municipio, valor } }`
  - `resumirReportes(reportes: { produto: string; municipio: string; valor: number }[]) → ResumoProduto[]` com `ResumoProduto = { produto, rotulo, unidade, media, contagem, municipios: { municipio, media, contagem }[] }`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/0003_reportes.sql`:

```sql
-- Termômetro da Praça: reportes anônimos de preço local, moderados manualmente.
create table reportes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (produto in ('boi', 'bezerro', 'vaca', 'soja', 'milho')),
  municipio text not null,
  valor numeric not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  ip_hash text,
  criado_em timestamptz not null default now()
);

create index reportes_aprovados_recentes on reportes (status, criado_em desc);
create index reportes_ip_recentes on reportes (ip_hash, criado_em desc);

alter table reportes enable row level security;

-- Público só enxerga aprovados; escrita apenas via service role (sem policy de insert/update).
create policy "leitura publica de aprovados" on reportes
  for select using (status = 'aprovado');
```

- [ ] **Step 2: Write the failing tests**

Criar `tests/termometro.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validarReporte, resumirReportes, PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO } from '@/lib/termometro';

const corpo = (extra: Record<string, unknown> = {}) => ({
  produto: 'boi', municipio: 'Redenção', valor: 320, contato: '', ...extra,
});

describe('validarReporte', () => {
  it('aceita um reporte válido', () => {
    const v = validarReporte(corpo());
    expect(v).toEqual({ tipo: 'valido', reporte: { produto: 'boi', municipio: 'Redenção', valor: 320 } });
  });

  it('detecta honeypot preenchido', () => {
    expect(validarReporte(corpo({ contato: 'zap 99999' }))).toEqual({ tipo: 'honeypot' });
  });

  it('rejeita produto fora da lista', () => {
    const v = validarReporte(corpo({ produto: 'cafe' }));
    expect(v.tipo).toBe('invalido');
  });

  it('rejeita município fora da lista', () => {
    const v = validarReporte(corpo({ municipio: 'Goiânia' }));
    expect(v.tipo).toBe('invalido');
  });

  it('rejeita valor fora da faixa do produto (apontando a faixa)', () => {
    const v = validarReporte(corpo({ valor: 90 }));
    expect(v).toMatchObject({ tipo: 'invalido' });
    if (v.tipo === 'invalido') expect(v.erro).toMatch(/150.*600/);
    const v2 = validarReporte(corpo({ produto: 'bezerro', valor: 7000 }));
    expect(v2.tipo).toBe('invalido');
  });

  it('rejeita valor não numérico ou corpo malformado', () => {
    expect(validarReporte(corpo({ valor: 'trezentos' })).tipo).toBe('invalido');
    expect(validarReporte(null).tipo).toBe('invalido');
    expect(validarReporte('oi').tipo).toBe('invalido');
  });

  it('aceita os limites das faixas (inclusivos)', () => {
    expect(validarReporte(corpo({ valor: 150 })).tipo).toBe('valido');
    expect(validarReporte(corpo({ valor: 600 })).tipo).toBe('valido');
  });
});

describe('resumirReportes', () => {
  const r = (produto: string, municipio: string, valor: number) => ({ produto, municipio, valor });

  it('agrega média regional e por município, na ordem fixa', () => {
    const resumo = resumirReportes([
      r('soja', 'Vila Rica', 110),
      r('boi', 'Redenção', 320),
      r('boi', 'Redenção', 330),
      r('boi', 'Confresa', 310),
    ]);
    expect(resumo.map((x) => x.produto)).toEqual(['boi', 'soja']); // ordem fixa, sem produtos vazios
    expect(resumo[0]).toMatchObject({ rotulo: 'Boi gordo', unidade: 'R$/@', media: 320, contagem: 3 });
    expect(resumo[0].municipios).toEqual([
      { municipio: 'Redenção', media: 325, contagem: 2 },
      { municipio: 'Confresa', media: 310, contagem: 1 },
    ]);
  });

  it('arredonda médias a 2 casas', () => {
    const resumo = resumirReportes([r('milho', 'Vila Rica', 50), r('milho', 'Vila Rica', 51)]);
    expect(resumo[0].media).toBe(50.5);
  });

  it('lista vazia devolve vazio', () => {
    expect(resumirReportes([])).toEqual([]);
  });
});

describe('constantes', () => {
  it('produtos e municípios na ordem certa', () => {
    expect(ORDEM_PRODUTOS).toEqual(['boi', 'bezerro', 'vaca', 'soja', 'milho']);
    expect(PRODUTOS.bezerro.unidade).toBe('R$/cabeça');
    expect(MUNICIPIOS_TERMOMETRO).toEqual([
      'Redenção', 'Santana do Araguaia', 'Vila Rica', 'Confresa', 'São Félix do Araguaia',
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/termometro.test.ts`
Expected: FAIL — `Cannot find module '@/lib/termometro'`.

- [ ] **Step 4: Write the implementation**

Criar `lib/termometro.ts`:

```ts
import { MUNICIPIOS } from '@/lib/fontes/chuva';

export type ProdutoTermometro = 'boi' | 'bezerro' | 'vaca' | 'soja' | 'milho';

// Faixas plausíveis: bloqueiam erro de digitação/troll, não a variação real de mercado.
export const PRODUTOS: Record<ProdutoTermometro, { rotulo: string; unidade: string; min: number; max: number }> = {
  boi: { rotulo: 'Boi gordo', unidade: 'R$/@', min: 150, max: 600 },
  bezerro: { rotulo: 'Bezerro', unidade: 'R$/cabeça', min: 800, max: 6000 },
  vaca: { rotulo: 'Vaca gorda', unidade: 'R$/@', min: 130, max: 550 },
  soja: { rotulo: 'Soja', unidade: 'R$/sc 60kg', min: 40, max: 300 },
  milho: { rotulo: 'Milho', unidade: 'R$/sc 60kg', min: 20, max: 200 },
};

export const ORDEM_PRODUTOS: ProdutoTermometro[] = ['boi', 'bezerro', 'vaca', 'soja', 'milho'];

export const MUNICIPIOS_TERMOMETRO: string[] = MUNICIPIOS.map((m) => m.nome);

export type ReporteValido = { produto: ProdutoTermometro; municipio: string; valor: number };

export type Validacao =
  | { tipo: 'honeypot' }
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; reporte: ReporteValido };

export function validarReporte(body: unknown): Validacao {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.contato === 'string' && b.contato.trim() !== '') {
    return { tipo: 'honeypot' };
  }
  const produto = b.produto as ProdutoTermometro;
  if (typeof produto !== 'string' || !(produto in PRODUTOS)) {
    return { tipo: 'invalido', erro: 'Escolha um produto da lista.' };
  }
  const municipio = b.municipio;
  if (typeof municipio !== 'string' || !MUNICIPIOS_TERMOMETRO.includes(municipio)) {
    return { tipo: 'invalido', erro: 'Escolha um município da lista.' };
  }
  const valor = Number(b.valor);
  const { min, max, unidade } = PRODUTOS[produto];
  if (!Number.isFinite(valor) || valor < min || valor > max) {
    return { tipo: 'invalido', erro: `Valor fora da faixa esperada (${min} a ${max} ${unidade}).` };
  }
  return { tipo: 'valido', reporte: { produto, municipio, valor } };
}

export type ReporteAprovado = { produto: string; municipio: string; valor: number };

export type ResumoProduto = {
  produto: ProdutoTermometro;
  rotulo: string;
  unidade: string;
  media: number;
  contagem: number;
  municipios: { municipio: string; media: number; contagem: number }[];
};

const media2 = (valores: number[]) =>
  Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100;

// Agrega reportes JÁ filtrados (aprovados, últimos 7 dias — responsabilidade da query).
export function resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[] {
  return ORDEM_PRODUTOS.flatMap((produto) => {
    const doProduto = reportes.filter((r) => r.produto === produto);
    if (doProduto.length === 0) return [];
    const municipios = MUNICIPIOS_TERMOMETRO.flatMap((municipio) => {
      const valores = doProduto.filter((r) => r.municipio === municipio).map((r) => r.valor);
      return valores.length === 0 ? [] : [{ municipio, media: media2(valores), contagem: valores.length }];
    });
    return [
      {
        produto,
        rotulo: PRODUTOS[produto].rotulo,
        unidade: PRODUTOS[produto].unidade,
        media: media2(doProduto.map((r) => r.valor)),
        contagem: doProduto.length,
        municipios,
      },
    ];
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/termometro.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 6: Full suite + commit**

Run: `npm test` — Expected: 101 + 12 novos.

```bash
git add supabase/migrations/0003_reportes.sql lib/termometro.ts tests/termometro.test.ts
git commit -m "feat: migracao de reportes e logica pura do termometro"
```

---

### Task 2: Rota `POST /api/reportar`

**Files:**
- Create: `app/api/reportar/route.ts`
- Test: `tests/api/reportar.test.ts`

**Interfaces:**
- Consumes: `validarReporte` (Task 1); `createServerClient` de `@/lib/supabase/server` (existente, service role); `createHash` de `node:crypto`.
- Produces: `POST /api/reportar` — 200 `{ recebido: true }` (sucesso e honeypot), 400 `{ erro }`, 429 `{ erro }`, 500 `{ erro }`.

- [ ] **Step 1: Write the failing tests**

Criar `tests/api/reportar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/reportar/route';
import { createServerClient } from '@/lib/supabase/server';

// Mock encadeável: count de reportes recentes por IP + insert.
function mockSupabase({ count = 0, countError = null, insertError = null }: {
  count?: number; countError?: unknown; insertError?: unknown;
} = {}) {
  const insert = vi.fn(async () => ({ error: insertError }));
  const gte = vi.fn(async () => ({ count, error: countError }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ select, insert })),
  });
  return { insert };
}

const req = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://localhost/api/reportar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });

const valido = { produto: 'boi', municipio: 'Redenção', valor: 320, contato: '' };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/reportar', () => {
  it('200 grava reporte pendente com ip_hash (sem IP puro)', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req(valido));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recebido: true });
    const gravado = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).toMatchObject({ produto: 'boi', municipio: 'Redenção', valor: 320 });
    expect(String(gravado.ip_hash)).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
    expect(String(gravado.ip_hash)).not.toContain('1.2.3.4');
  });

  it('400 para reporte inválido, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, valor: 5 }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('honeypot: 200 de mentira, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, contato: 'sou um bot' }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('429 quando o IP já mandou 5 em 24h', async () => {
    const { insert } = mockSupabase({ count: 5 });
    const res = await POST(req(valido));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it('500 quando o banco falha no insert', async () => {
    mockSupabase({ insertError: { message: 'boom' } });
    const res = await POST(req(valido));
    expect(res.status).toBe(500);
  });

  it('corpo que não é JSON vira 400', async () => {
    mockSupabase();
    const res = await POST(new Request('http://localhost/api/reportar', { method: 'POST', body: 'nao-json' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/reportar.test.ts`
Expected: FAIL — módulo da rota inexistente.

- [ ] **Step 3: Write the implementation**

Criar `app/api/reportar/route.ts`:

```ts
import { createHash } from 'node:crypto';
import { createServerClient } from '@/lib/supabase/server';
import { validarReporte } from '@/lib/termometro';

export const dynamic = 'force-dynamic';

const LIMITE_24H = 5;

// Hash do IP para o limite diário — nunca guardamos o IP puro.
function ipHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  return createHash('sha256').update(ip).digest('hex');
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const validacao = validarReporte(body);
  if (validacao.tipo === 'honeypot') {
    // Bot detectado: responde como sucesso e descarta (não educa o bot).
    return Response.json({ recebido: true });
  }
  if (validacao.tipo === 'invalido') {
    return Response.json({ erro: validacao.erro }, { status: 400 });
  }

  const supabase = createServerClient();
  const hash = ipHash(req);
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: erroContagem } = await supabase
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash)
    .gte('criado_em', desde);
  if (erroContagem) {
    return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  }
  if ((count ?? 0) >= LIMITE_24H) {
    return Response.json({ erro: 'Limite diário atingido — tente amanhã.' }, { status: 429 });
  }

  const { error } = await supabase.from('reportes').insert({ ...validacao.reporte, ip_hash: hash });
  if (error) {
    return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  }
  return Response.json({ recebido: true });
}
```

Nota sobre o mock do teste: a query real encadeia `.select('id', { count: 'exact', head: true }).eq(...).gte(...)` e o resultado (`{ count }`) vem do `await` no fim da cadeia — o mock reflete isso com `gte` assíncrono.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/reportar.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Full suite + commit**

Run: `npm test && npm run build && npm run lint` — Expected: tudo limpo.

```bash
git add app/api/reportar/route.ts tests/api/reportar.test.ts
git commit -m "feat: rota POST /api/reportar com honeypot e limite por IP"
```

---

### Task 3: Páginas `/termometro` e `/termometro/reportar` + header

**Files:**
- Create: `components/CardTermometro.tsx`
- Create: `components/FormReporte.tsx` (client)
- Create: `app/termometro/page.tsx`
- Create: `app/termometro/reportar/page.tsx`
- Modify: `components/Header.tsx` (item "Termômetro")
- Test: `tests/components/CardTermometro.test.tsx`, `tests/components/FormReporte.test.tsx`

**Interfaces:**
- Consumes: `resumirReportes`, `ResumoProduto`, `PRODUTOS`, `ORDEM_PRODUTOS`, `MUNICIPIOS_TERMOMETRO` (Task 1); `POST /api/reportar` (Task 2); `createPublicClient` (existente).
- Produces: páginas finais.

- [ ] **Step 1: Write the failing tests**

Criar `tests/components/CardTermometro.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardTermometro } from '@/components/CardTermometro';
import type { ResumoProduto } from '@/lib/termometro';

const resumo: ResumoProduto = {
  produto: 'boi', rotulo: 'Boi gordo', unidade: 'R$/@', media: 325.5, contagem: 3,
  municipios: [
    { municipio: 'Redenção', media: 330, contagem: 2 },
    { municipio: 'Confresa', media: 316.5, contagem: 1 },
  ],
};

describe('CardTermometro', () => {
  it('mostra rótulo, média, contagem e municípios', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('325,5')).toBeInTheDocument();
    expect(screen.getByText('3 reportes · últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
    expect(screen.getByText(/316,5/)).toBeInTheDocument();
  });

  it('singular para 1 reporte', () => {
    render(<CardTermometro resumo={{ ...resumo, contagem: 1, municipios: [] }} />);
    expect(screen.getByText('1 reporte · últimos 7 dias')).toBeInTheDocument();
  });

  it('mostra o contraste com a média CONAB quando informada', () => {
    render(<CardTermometro resumo={resumo} mediaConab={326.96} />);
    expect(screen.getByText(/média CONAB: 326,96/)).toBeInTheDocument();
  });
});
```

Criar `tests/components/FormReporte.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormReporte } from '@/components/FormReporte';

beforeEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status }) as never,
  );
}

describe('FormReporte', () => {
  it('renderiza os campos e o botão', () => {
    render(<FormReporte />);
    expect(screen.getByLabelText('Produto')).toBeInTheDocument();
    expect(screen.getByLabelText('Município')).toBeInTheDocument();
    expect(screen.getByLabelText(/Preço/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar preço' })).toBeInTheDocument();
  });

  it('envia e mostra a confirmação', async () => {
    const f = mockFetch(200, { recebido: true });
    render(<FormReporte />);
    fireEvent.change(screen.getByLabelText(/Preço/), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar preço' }));
    expect(await screen.findByText(/Recebido!/)).toBeInTheDocument();
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({ produto: 'boi', municipio: 'Redenção', valor: 320, contato: '' });
  });

  it('mostra o erro da API (faixa ou limite)', async () => {
    mockFetch(429, { erro: 'Limite diário atingido — tente amanhã.' });
    render(<FormReporte />);
    fireEvent.change(screen.getByLabelText(/Preço/), { target: { value: '320' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar preço' }));
    expect(await screen.findByText(/Limite diário/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/CardTermometro.test.tsx tests/components/FormReporte.test.tsx`
Expected: FAIL — módulos inexistentes. (Se `@testing-library/user-event` não existir no projeto, use `fireEvent` do `@testing-library/react` para digitar/clicar — sem instalar nada.)

- [ ] **Step 3: Write the implementations**

Criar `components/CardTermometro.tsx`:

```tsx
import type { ResumoProduto } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function CardTermometro({ resumo, mediaConab }: { resumo: ResumoProduto; mediaConab?: number }) {
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{resumo.rotulo}</h2>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{resumo.unidade}</p>
      <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-tinta">{fmt.format(resumo.media)}</p>
      <p className="mt-1 text-xs text-tinta/40">
        {resumo.contagem} {resumo.contagem === 1 ? 'reporte' : 'reportes'} · últimos 7 dias
      </p>
      {mediaConab !== undefined && (
        <p className="mt-1 text-xs text-tinta/50">média CONAB: {fmt.format(mediaConab)}</p>
      )}
      {resumo.municipios.length > 0 && (
        <ul className="mt-4 divide-y divide-linha/70 border-t border-linha/70">
          {resumo.municipios.map((m) => (
            <li key={m.municipio} className="flex items-baseline justify-between gap-2 py-1.5 text-sm tabular-nums">
              <span className="text-tinta/60">{m.municipio}</span>
              <span className="text-tinta/80">
                {fmt.format(m.media)} <span className="text-xs text-tinta/40">({m.contagem})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Criar `components/FormReporte.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO, type ProdutoTermometro } from '@/lib/termometro';

export function FormReporte() {
  const [produto, setProduto] = useState<ProdutoTermometro>('boi');
  const [municipio, setMunicipio] = useState(MUNICIPIOS_TERMOMETRO[0]);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="rounded-xl border border-linha bg-papel p-6">
        <p className="font-display text-xl font-bold text-mata">Recebido!</p>
        <p className="mt-1 text-sm text-tinta/60">Seu preço entra na média depois de conferido. Obrigado por fortalecer a praça.</p>
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/reportar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ produto, municipio, valor: Number(valor.replace(',', '.')), contato: '' }),
      });
      if (res.ok) {
        setEnviado(true);
      } else {
        const body = (await res.json().catch(() => null)) as { erro?: string } | null;
        setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
      }
    } catch {
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const campo = 'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-tinta/70">
        Produto
        <select value={produto} onChange={(e) => setProduto(e.target.value as ProdutoTermometro)} className={campo}>
          {ORDEM_PRODUTOS.map((p) => (
            <option key={p} value={p}>
              {PRODUTOS[p].rotulo} ({PRODUTOS[p].unidade})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Município
        <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={campo}>
          {MUNICIPIOS_TERMOMETRO.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Preço ({PRODUTOS[produto].unidade})
        <input
          type="text" inputMode="decimal" required value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={`ex.: ${PRODUTOS[produto].min + Math.round((PRODUTOS[produto].max - PRODUTOS[produto].min) / 2)}`}
          className={campo}
        />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit" disabled={enviando}
        className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        {enviando ? 'Enviando…' : 'Enviar preço'}
      </button>
    </form>
  );
}
```

Criar `app/termometro/page.tsx`:

```tsx
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardTermometro } from '@/components/CardTermometro';
import { resumirReportes } from '@/lib/termometro';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Termômetro da Praça — Praça Araguaia' };

export default async function Termometro() {
  const supabase = createPublicClient();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // A RLS só entrega aprovados para o client anon.
  const { data: reportes } = await supabase
    .from('reportes')
    .select('produto, municipio, valor')
    .gte('criado_em', desde);

  const { data: cotacoes } = await supabase.from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const resumos = resumirReportes(
    (reportes ?? []).map((r) => ({ produto: r.produto, municipio: r.municipio, valor: Number(r.valor) })),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Preço de quem tá na lida</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Termômetro da Praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Média dos preços reportados por produtores da região nos últimos 7 dias, conferidos antes de entrar na conta.
      </p>

      <Link
        href="/termometro/reportar"
        className="mt-5 inline-block rounded-lg bg-pasto px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Reportar preço
      </Link>

      {resumos.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
          <p className="font-display text-lg font-bold text-mata">Seja o primeiro a reportar o preço da sua praça</p>
          <p className="mt-1 text-sm text-tinta/50">Leva menos de um minuto e não pede cadastro.</p>
        </div>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {resumos.map((r) => (
            <CardTermometro key={r.produto} resumo={r} mediaConab={conab.get(r.produto)} />
          ))}
        </section>
      )}
    </main>
  );
}
```

Criar `app/termometro/reportar/page.tsx`:

```tsx
import Link from 'next/link';
import { FormReporte } from '@/components/FormReporte';

export const metadata = { title: 'Reportar preço — Praça Araguaia' };

export default function Reportar() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/termometro" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Sem cadastro · anônimo</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Qual o preço na sua praça?</h1>
      <p className="mt-1 text-sm text-tinta/50">Seu reporte é conferido antes de entrar na média da região.</p>

      <div className="mt-6">
        <FormReporte />
      </div>
    </main>
  );
}
```

Em `components/Header.tsx`, adicionar à constante `LINKS` (depois de Chuva):

```ts
  { href: '/termometro', rotulo: 'Termômetro' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/CardTermometro.test.tsx tests/components/FormReporte.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Full suite + build + lint + commit**

Run: `npm test && npm run build && npm run lint` — Expected: tudo limpo; build lista `/termometro` e `/termometro/reportar`.

```bash
git add components/CardTermometro.tsx components/FormReporte.tsx app/termometro/ components/Header.tsx tests/components/CardTermometro.test.tsx tests/components/FormReporte.test.tsx
git commit -m "feat: paginas do termometro (medias 7d e form de reporte) e item no header"
```

---

### Task 4: Migração no Supabase + e2e + deploy

**Files:**
- Modify: `ESTADO-DO-PROJETO.md`

**Interfaces:** consome tudo das Tasks 1–3; produz o Termômetro no ar.

- [ ] **Step 1: Aplicar a migração no Supabase** (projeto `eoguwsybosgzfeiqqxjk`) — via MCP `apply_migration` com o conteúdo de `0003_reportes.sql`, ou colando no SQL Editor do dashboard.

- [ ] **Step 2: E2E local** — subir `npm run dev` e:

```powershell
# reporte válido
curl.exe -s -X POST http://localhost:3000/api/reportar -H "content-type: application/json" -d '{\"produto\":\"boi\",\"municipio\":\"Redenção\",\"valor\":320,\"contato\":\"\"}'
# fora da faixa (espera 400)
curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:3000/api/reportar -H "content-type: application/json" -d '{\"produto\":\"boi\",\"municipio\":\"Redenção\",\"valor\":5,\"contato\":\"\"}'
```

Aprovar o reporte de teste (SQL via MCP: `update reportes set status = 'aprovado' where status = 'pendente';`), abrir `/termometro` e conferir a média com contraste CONAB. Depois **apagar o reporte de teste** (`delete from reportes;`). Encerrar o dev server.

- [ ] **Step 3: Atualizar `ESTADO-DO-PROJETO.md`** — fatia 8 em "O que já está pronto" (incluindo: moderação v1 = mudar `status` na tabela `reportes` pelo dashboard; T2 = UI de moderação; T3 = OTP/reputação/mediana como próximas), contagem de testes, e commitar:

```bash
git add ESTADO-DO-PROJETO.md
git commit -m "docs: estado do projeto com a fatia 8 (termometro T1)"
```

- [ ] **Step 4: Deploy (REQUER APROVAÇÃO DO USUÁRIO)** — `git push origin master` e verificar em produção: POST de teste + aprovação + `/termometro` + limpeza do dado de teste.
