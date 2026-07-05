# Calculadora do Produtor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/calculadora` com o valor de um lote de boi (peso vivo + rendimento → arrobas → R$) e de uma colheita de grãos (sacas → R$), com preços pré-preenchidos das cotações ao vivo.

**Architecture:** Funções puras em `lib/calculadora.ts`; um client component com dois blocos que recalculam ao digitar; uma página server que busca os preços atuais e os passa como defaults; link no Header. Sem banco de escrita, deps ou PII.

**Tech Stack:** Next 15 App Router, TypeScript strict, Vitest + Testing Library, Tailwind v4, Supabase (só leitura de cotações).

## Global Constraints

- Zero dependências novas, sem migração, sem env, sem rotas de API, sem escrita no banco.
- Arroba do boi = **15 kg de carcaça**: `arrobas = pesoVivo × rendimento% ÷ 15`. Rendimento padrão **50**. Saca = **60 kg**.
- Todas as funções puras arredondam a **2 casas**; entrada não-finita ou negativa → **0** (nunca mostrar `NaN`).
- Preço pré-preenchido das cotações (`boi` R$/@, `soja`/`milho` R$/sc) e **editável**.
- Reusa `normalizarValor` de `@/lib/termometro` (parser pt-BR) para os campos.
- Formatação `Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })`; inputs `inputMode="decimal"`; tokens visuais do projeto (mata/pasto/papel/linha/tinta). Textos pt-BR.

---

### Task 1: Lógica pura (`lib/calculadora.ts`)

**Files:**
- Create: `lib/calculadora.ts`
- Test: `tests/calculadora.test.ts`

**Interfaces:**
- Consumes: nada do projeto.
- Produces (consumido pela Task 2):
  - `arrobasDeBoi(pesoVivoKg: number, rendimentoPct: number): number`
  - `valorEmReais(quantidade: number, preco: number): number`
  - `sacasParaKg(sacas: number): number`
  - `kgParaSacas(kg: number): number`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/calculadora.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arrobasDeBoi, valorEmReais, sacasParaKg, kgParaSacas } from '@/lib/calculadora';

describe('arrobasDeBoi', () => {
  it('peso vivo × rendimento ÷ 15', () => {
    expect(arrobasDeBoi(480, 50)).toBe(16);
    expect(arrobasDeBoi(500, 52)).toBe(17.33); // 500*0.52/15 = 17.333..
  });
  it('rendimento 0 ou entrada inválida → 0', () => {
    expect(arrobasDeBoi(480, 0)).toBe(0);
    expect(arrobasDeBoi(NaN, 50)).toBe(0);
    expect(arrobasDeBoi(-10, 50)).toBe(0);
  });
});

describe('valorEmReais', () => {
  it('quantidade × preço, 2 casas', () => {
    expect(valorEmReais(16, 320)).toBe(5120);
    expect(valorEmReais(10.5, 2.5)).toBe(26.25);
  });
  it('entrada inválida/negativa → 0', () => {
    expect(valorEmReais(NaN, 320)).toBe(0);
    expect(valorEmReais(16, -1)).toBe(0);
  });
});

describe('conversão de sacas', () => {
  it('sacas ↔ kg (saca = 60 kg)', () => {
    expect(sacasParaKg(10)).toBe(600);
    expect(kgParaSacas(600)).toBe(10);
    expect(kgParaSacas(630)).toBe(10.5);
  });
  it('entrada inválida → 0', () => {
    expect(sacasParaKg(NaN)).toBe(0);
    expect(kgParaSacas(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/calculadora.test.ts`
Expected: FAIL — `Cannot find module '@/lib/calculadora'`.

- [ ] **Step 3: Implementar `lib/calculadora.ts`**

```ts
// Arredonda a 2 casas; entrada não-finita ou negativa vira 0 (a calculadora nunca mostra NaN).
function saneia(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

// A arroba do boi gordo é 15 kg de carcaça; o rendimento converte peso vivo em carcaça.
export function arrobasDeBoi(pesoVivoKg: number, rendimentoPct: number): number {
  return saneia((pesoVivoKg * (rendimentoPct / 100)) / 15);
}

// Genérico: arrobas × R$/@ (boi) ou sacas × R$/sc (grãos).
export function valorEmReais(quantidade: number, preco: number): number {
  if (!(quantidade >= 0) || !(preco >= 0)) return 0;
  return saneia(quantidade * preco);
}

export function sacasParaKg(sacas: number): number {
  return saneia(sacas * 60);
}

export function kgParaSacas(kg: number): number {
  return saneia(kg / 60);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/calculadora.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calculadora.ts tests/calculadora.test.ts
git commit -m "feat: logica pura da calculadora do produtor"
```

---

### Task 2: Componente, página e link no Header

**Files:**
- Create: `components/Calculadora.tsx`
- Create: `app/calculadora/page.tsx`
- Modify: `components/Header.tsx` (novo item no menu)
- Test: `tests/components/Calculadora.test.tsx`

**Interfaces:**
- Consumes (Task 1): `arrobasDeBoi`, `valorEmReais`, `sacasParaKg`; `normalizarValor` de `@/lib/termometro`; `createPublicClient` de `@/lib/supabase/public`.
- Produces: nenhum (fatia final).

- [ ] **Step 1: Escrever o teste do componente (falhando)**

Criar `tests/components/Calculadora.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Calculadora } from '@/components/Calculadora';

describe('Calculadora', () => {
  it('pré-preenche o preço do boi vindo dos preços', () => {
    render(<Calculadora precos={{ boi: 320, soja: 130, milho: 55 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/@/i) as HTMLInputElement).value).toBe('320');
  });

  it('calcula arrobas e valor do lote de boi', () => {
    render(<Calculadora precos={{ boi: 320 }} />);
    fireEvent.change(screen.getByLabelText(/peso vivo/i), { target: { value: '480' } });
    fireEvent.change(screen.getByLabelText(/rendimento/i), { target: { value: '50' } });
    expect(screen.getByTestId('boi-arrobas')).toHaveTextContent('16');
    expect(screen.getByTestId('boi-valor')).toHaveTextContent('5.120');
  });

  it('grãos: sacas mostram o equivalente em kg e o valor da colheita', () => {
    render(<Calculadora precos={{ soja: 130 }} />);
    fireEvent.change(screen.getByLabelText(/sacas/i), { target: { value: '10' } });
    expect(screen.getByTestId('graos-kg')).toHaveTextContent('600');
    expect(screen.getByTestId('graos-valor')).toHaveTextContent('1.300');
  });

  it('trocar o produto dos grãos troca o preço padrão', () => {
    render(<Calculadora precos={{ soja: 130, milho: 55 }} />);
    expect((screen.getByLabelText(/preço.*R\$\/sc/i) as HTMLInputElement).value).toBe('130');
    fireEvent.change(screen.getByLabelText(/produto/i), { target: { value: 'milho' } });
    expect((screen.getByLabelText(/preço.*R\$\/sc/i) as HTMLInputElement).value).toBe('55');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/Calculadora.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `components/Calculadora.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { arrobasDeBoi, valorEmReais, sacasParaKg } from '@/lib/calculadora';
import { normalizarValor } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (s: string) => normalizarValor(s);
const precoInicial = (v?: number) => (v === undefined ? '' : String(v));

type Precos = { boi?: number; soja?: number; milho?: number };
type ProdutoGrao = 'soja' | 'milho';

const campo =
  'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';

export function Calculadora({ precos }: { precos: Precos }) {
  // Boi
  const [peso, setPeso] = useState('');
  const [rendimento, setRendimento] = useState('50');
  const [precoBoi, setPrecoBoi] = useState(precoInicial(precos.boi));
  const arrobas = arrobasDeBoi(num(peso), num(rendimento));
  const valorBoi = valorEmReais(arrobas, num(precoBoi));

  // Grãos
  const [produto, setProduto] = useState<ProdutoGrao>('soja');
  const [sacas, setSacas] = useState('');
  const [precoGrao, setPrecoGrao] = useState(precoInicial(precos.soja));
  const kg = sacasParaKg(num(sacas));
  const valorGrao = valorEmReais(num(sacas), num(precoGrao));

  function trocarProduto(p: ProdutoGrao) {
    setProduto(p);
    setPrecoGrao(precoInicial(precos[p]));
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <section className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
        <h2 className="font-display text-lg font-bold text-mata">Lote de boi gordo</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Peso vivo (kg)
            <input aria-label="peso vivo (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Rendimento (%)
            <input aria-label="rendimento (%)" inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Preço (R$/@)
            <input aria-label="preço (R$/@)" inputMode="decimal" value={precoBoi} onChange={(e) => setPrecoBoi(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="text-sm text-tinta/60">
            Arrobas: <span data-testid="boi-arrobas" className="font-display text-xl font-bold tabular-nums text-tinta">{fmt.format(arrobas)}</span>
          </p>
          <p className="text-sm text-tinta/60">
            Valor do lote: <span data-testid="boi-valor" className="font-display text-2xl font-bold tabular-nums text-mata">R$ {fmt.format(valorBoi)}</span>
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
        <h2 className="font-display text-lg font-bold text-mata">Colheita de grãos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Produto
            <select aria-label="produto" value={produto} onChange={(e) => trocarProduto(e.target.value as ProdutoGrao)} className={campo}>
              <option value="soja">Soja</option>
              <option value="milho">Milho</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Sacas (60 kg)
            <input aria-label="sacas" inputMode="decimal" value={sacas} onChange={(e) => setSacas(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Preço (R$/sc)
            <input aria-label="preço (R$/sc)" inputMode="decimal" value={precoGrao} onChange={(e) => setPrecoGrao(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="text-sm text-tinta/60">
            Equivale a <span data-testid="graos-kg" className="font-semibold tabular-nums text-tinta">{fmt.format(kg)}</span> kg
          </p>
          <p className="text-sm text-tinta/60">
            Valor da colheita: <span data-testid="graos-valor" className="font-display text-2xl font-bold tabular-nums text-mata">R$ {fmt.format(valorGrao)}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `app/calculadora/page.tsx`**

```tsx
import { createPublicClient } from '@/lib/supabase/public';
import { Calculadora } from '@/components/Calculadora';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calculadora — Praça Araguaia' };

export default async function CalculadoraPage() {
  const supabase = createPublicClient();
  const { data } = await supabase.from('cotacoes').select('tipo, valor').in('tipo', ['boi', 'soja', 'milho']);
  const mapa = new Map((data ?? []).map((c) => [c.tipo as string, Number(c.valor)]));
  const precos = { boi: mapa.get('boi'), soja: mapa.get('soja'), milho: mapa.get('milho') };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Conta de porteira</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Calculadora do produtor</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Quanto vale seu lote de boi e sua colheita — com o preço da praça já preenchido, é só ajustar.
      </p>
      <Calculadora precos={precos} />
    </main>
  );
}
```

- [ ] **Step 5: Acrescentar o link no Header**

Em `components/Header.tsx`, adicionar ao array `LINKS` (após `Fornecedores`):

```tsx
  { href: '/calculadora', rotulo: 'Calculadora' },
```

- [ ] **Step 6: Rodar os testes do componente**

Run: `npx vitest run tests/components/Calculadora.test.tsx`
Expected: PASS.

- [ ] **Step 7: Suíte completa, build e lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: toda a suíte PASS (203 + os novos), build e lint limpos. A rota `/calculadora` aparece como dinâmica (ƒ).

- [ ] **Step 8: Commit**

```bash
git add components/Calculadora.tsx app/calculadora/page.tsx components/Header.tsx tests/components/Calculadora.test.tsx
git commit -m "feat: pagina da calculadora do produtor (boi + graos) com preco ao vivo"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch (opus).
2. E2E local: `/calculadora` abre com os preços pré-preenchidos (com dado de cotação no banco); digitar peso/rendimento mostra arrobas e valor; grãos calcula valor e kg; trocar produto troca o preço; item "Calculadora" no Header.
3. Push com aprovação → deploy; verificação em produção.
4. Atualizar `ESTADO-DO-PROJETO.md` (fatia 14) e memória; registrar a lição CONAB municipal (inviável) no doc.

## Self-Review (feito)

- **Cobertura da spec:** funções puras + guardas (Task 1); componente com boi (arrobas+valor), grãos (kg+valor+troca de produto), preço pré-preenchido, página server com leitura de cotações, link no Header (Task 2); testes de lógica e de componente. ✔
- **Placeholders:** nenhum — todo passo traz o código real. ✔
- **Consistência de tipos:** `arrobasDeBoi`/`valorEmReais`/`sacasParaKg`/`kgParaSacas` idênticos entre Task 1 e Task 2; `precos: { boi?; soja?; milho? }` idêntico entre página, componente e testes; `normalizarValor` importado de `@/lib/termometro` (existe e é exportado). ✔
- **Nota:** o teste do valor de boi usa `precos={{ boi: 320 }}` e peso 480/rend 50 → 16 @ → R$ 5.120 (`fmt.format` = "5.120"); grãos 10 sacas × 130 = R$ 1.300 ("1.300"). Consistente com a formatação pt-BR.
