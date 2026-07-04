# Vitrine de Fornecedores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/fornecedores` com diretório curado de fornecedores da praça, filtrável por categoria, com contato por link `wa.me` — entregue completa e vazia (estado "em breve").

**Architecture:** Dados e lógica pura em `lib/fornecedores.ts` (lista curada vazia, `linkWhatsApp`, `agruparPorCategoria`); um card puro e um client component de filtro; página estática que os renderiza; link no Header. Sem banco, deps, rotas de API ou PII.

**Tech Stack:** Next 15 App Router, TypeScript strict, Vitest + Testing Library, Tailwind v4.

## Global Constraints

- Zero dependências novas, sem migração, sem env, sem rotas de API, sem banco.
- `whatsapp` guardado como **só dígitos com DDI** (`^\d{12,13}$` = 55 + DDD + número). Link via `wa.me/<digitos>?text=<mensagem codificada>`.
- Mensagem padrão: `'Olá! Vi seu contato na Praça Araguaia.'`.
- `FORNECEDORES` começa **vazio** — nenhum dado fictício no ar.
- Botão de contato: `target="_blank"` + `rel="noopener noreferrer"`.
- Categorias (ordem fixa): Ração e sal · Defensivos e sementes · Veterinário · Máquinas e peças · Assistência técnica.
- Estado vazio geral: `"Vitrine em breve — estamos reunindo os fornecedores da praça."` Filtro sem resultado: `"Nenhum fornecedor nesta categoria ainda."`.
- Textos pt-BR; tokens visuais do projeto (mata/pasto/papel/linha/tinta); chips no estilo do toggle do gráfico (ativo `bg-mata text-white`).

---

### Task 1: Dados e lógica (`lib/fornecedores.ts`)

**Files:**
- Create: `lib/fornecedores.ts`
- Test: `tests/fornecedores.test.ts`

**Interfaces:**
- Consumes: nada do projeto.
- Produces (consumido pela Task 2):
  - `type CategoriaFornecedor` (union das 5 ids)
  - `CATEGORIAS: { id: CategoriaFornecedor; rotulo: string }[]`
  - `type Fornecedor = { nome: string; categoria: CategoriaFornecedor; oQueVende: string; municipio: string; whatsapp: string }`
  - `FORNECEDORES: Fornecedor[]` (vazio)
  - `MENSAGEM_PADRAO: string`
  - `linkWhatsApp(whatsapp: string, mensagem?: string): string`
  - `type GrupoFornecedores = { categoria: CategoriaFornecedor; rotulo: string; fornecedores: Fornecedor[] }`
  - `agruparPorCategoria(fornecedores: Fornecedor[], categoriaFiltro?: CategoriaFornecedor | null): GrupoFornecedores[]`

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `tests/fornecedores.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  linkWhatsApp,
  agruparPorCategoria,
  CATEGORIAS,
  FORNECEDORES,
  MENSAGEM_PADRAO,
  type Fornecedor,
  type CategoriaFornecedor,
} from '@/lib/fornecedores';

const f = (nome: string, categoria: CategoriaFornecedor, municipio = 'Redenção'): Fornecedor => ({
  nome,
  categoria,
  oQueVende: 'algo',
  municipio,
  whatsapp: '5594999998888',
});

describe('linkWhatsApp', () => {
  it('monta o link wa.me com a mensagem padrão codificada', () => {
    expect(linkWhatsApp('5594999998888')).toBe(
      `https://wa.me/5594999998888?text=${encodeURIComponent(MENSAGEM_PADRAO)}`,
    );
  });

  it('aceita mensagem custom, também codificada', () => {
    expect(linkWhatsApp('5594999998888', 'Oi, tudo bem?')).toBe(
      'https://wa.me/5594999998888?text=Oi%2C%20tudo%20bem%3F',
    );
  });
});

describe('agruparPorCategoria', () => {
  const lista = [
    f('Casa A', 'veterinario'),
    f('Casa B', 'racao-sal'),
    f('Casa C', 'racao-sal'),
  ];

  it('agrupa na ordem de CATEGORIAS e omite categorias vazias', () => {
    const grupos = agruparPorCategoria(lista);
    expect(grupos.map((g) => g.categoria)).toEqual(['racao-sal', 'veterinario']); // ordem fixa; sem as vazias
    expect(grupos[0].fornecedores.map((x) => x.nome)).toEqual(['Casa B', 'Casa C']);
    expect(grupos[0].rotulo).toBe('Ração e sal');
  });

  it('filtro por categoria devolve só aquela', () => {
    const grupos = agruparPorCategoria(lista, 'racao-sal');
    expect(grupos).toHaveLength(1);
    expect(grupos[0].categoria).toBe('racao-sal');
  });

  it('filtro numa categoria sem fornecedor devolve vazio', () => {
    expect(agruparPorCategoria(lista, 'maquinas-pecas')).toEqual([]);
  });

  it('lista vazia devolve vazio', () => {
    expect(agruparPorCategoria([])).toEqual([]);
  });
});

describe('invariante dos FORNECEDORES curados', () => {
  const ids = new Set(CATEGORIAS.map((c) => c.id));
  it('toda categoria é válida e o whatsapp é só dígitos (DDI+DDD+número)', () => {
    for (const forn of FORNECEDORES) {
      expect(ids.has(forn.categoria)).toBe(true);
      expect(forn.whatsapp).toMatch(/^\d{12,13}$/);
      expect(forn.nome.trim()).not.toBe('');
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fornecedores.test.ts`
Expected: FAIL — `Cannot find module '@/lib/fornecedores'`.

- [ ] **Step 3: Implementar `lib/fornecedores.ts`**

```ts
export type CategoriaFornecedor =
  | 'racao-sal'
  | 'defensivos-sementes'
  | 'veterinario'
  | 'maquinas-pecas'
  | 'assistencia-tecnica';

export const CATEGORIAS: { id: CategoriaFornecedor; rotulo: string }[] = [
  { id: 'racao-sal', rotulo: 'Ração e sal' },
  { id: 'defensivos-sementes', rotulo: 'Defensivos e sementes' },
  { id: 'veterinario', rotulo: 'Veterinário' },
  { id: 'maquinas-pecas', rotulo: 'Máquinas e peças' },
  { id: 'assistencia-tecnica', rotulo: 'Assistência técnica' },
];

export type Fornecedor = {
  nome: string;
  categoria: CategoriaFornecedor;
  oQueVende: string;
  municipio: string;
  whatsapp: string; // só dígitos com DDI, ex.: "5594999998888"
};

// Curada pelo dono. Vazia até os primeiros fornecedores reais entrarem.
export const FORNECEDORES: Fornecedor[] = [];

export const MENSAGEM_PADRAO = 'Olá! Vi seu contato na Praça Araguaia.';

// Monta o link wa.me com a mensagem pré-preenchida (o produtor é quem envia).
export function linkWhatsApp(whatsapp: string, mensagem: string = MENSAGEM_PADRAO): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

export type GrupoFornecedores = {
  categoria: CategoriaFornecedor;
  rotulo: string;
  fornecedores: Fornecedor[];
};

// Agrupa na ordem de CATEGORIAS, omitindo categorias sem fornecedor.
export function agruparPorCategoria(
  fornecedores: Fornecedor[],
  categoriaFiltro?: CategoriaFornecedor | null,
): GrupoFornecedores[] {
  return CATEGORIAS.flatMap(({ id, rotulo }) => {
    if (categoriaFiltro && categoriaFiltro !== id) return [];
    const doGrupo = fornecedores.filter((f) => f.categoria === id);
    return doGrupo.length === 0 ? [] : [{ categoria: id, rotulo, fornecedores: doGrupo }];
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/fornecedores.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fornecedores.ts tests/fornecedores.test.ts
git commit -m "feat: dados curados e logica da vitrine de fornecedores"
```

---

### Task 2: Card, vitrine (filtro), página e link no Header

**Files:**
- Create: `components/CardFornecedor.tsx`
- Create: `components/VitrineFornecedores.tsx`
- Create: `app/fornecedores/page.tsx`
- Modify: `components/Header.tsx` (novo item no menu)
- Test: `tests/components/CardFornecedor.test.tsx`
- Test: `tests/components/VitrineFornecedores.test.tsx`

**Interfaces:**
- Consumes (Task 1): `type Fornecedor`, `type CategoriaFornecedor`, `CATEGORIAS`, `FORNECEDORES`, `linkWhatsApp`, `agruparPorCategoria`.
- Produces: nenhum (fatia final).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/components/CardFornecedor.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardFornecedor } from '@/components/CardFornecedor';
import { MENSAGEM_PADRAO, type Fornecedor } from '@/lib/fornecedores';

const forn: Fornecedor = {
  nome: 'Agropecuária Boi Bom',
  categoria: 'racao-sal',
  oQueVende: 'Ração, sal mineral e suplementos',
  municipio: 'Redenção',
  whatsapp: '5594999998888',
};

describe('CardFornecedor', () => {
  it('mostra nome, o que vende e município', () => {
    render(<CardFornecedor fornecedor={forn} />);
    expect(screen.getByText('Agropecuária Boi Bom')).toBeInTheDocument();
    expect(screen.getByText('Ração, sal mineral e suplementos')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
  });

  it('o botão aponta para o wa.me com a mensagem padrão, em nova aba e seguro', () => {
    render(<CardFornecedor fornecedor={forn} />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', `https://wa.me/5594999998888?text=${encodeURIComponent(MENSAGEM_PADRAO)}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
```

Criar `tests/components/VitrineFornecedores.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';
import type { Fornecedor } from '@/lib/fornecedores';

const fornecedores: Fornecedor[] = [
  { nome: 'Casa Ração', categoria: 'racao-sal', oQueVende: 'ração', municipio: 'Redenção', whatsapp: '5594999998888' },
  { nome: 'Vet Araguaia', categoria: 'veterinario', oQueVende: 'vacinas', municipio: 'Confresa', whatsapp: '5566999997777' },
];

describe('VitrineFornecedores', () => {
  it('lista vazia mostra o estado "em breve" e não mostra chips', () => {
    render(<VitrineFornecedores fornecedores={[]} />);
    expect(screen.getByText(/Vitrine em breve/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ração e sal' })).not.toBeInTheDocument();
  });

  it('com fornecedores, mostra as seções por categoria', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    expect(screen.getByText('Casa Ração')).toBeInTheDocument();
    expect(screen.getByText('Vet Araguaia')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ração e sal' })).toBeInTheDocument();
  });

  it('clicar num chip filtra para aquela categoria', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    fireEvent.click(screen.getByRole('button', { name: 'Veterinário' }));
    expect(screen.getByText('Vet Araguaia')).toBeInTheDocument();
    expect(screen.queryByText('Casa Ração')).not.toBeInTheDocument();
  });

  it('chip de categoria sem fornecedor mostra a mensagem de vazio', () => {
    render(<VitrineFornecedores fornecedores={fornecedores} />);
    fireEvent.click(screen.getByRole('button', { name: 'Máquinas e peças' }));
    expect(screen.getByText('Nenhum fornecedor nesta categoria ainda.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/CardFornecedor.test.tsx tests/components/VitrineFornecedores.test.tsx`
Expected: FAIL — componentes não existem.

- [ ] **Step 3: Implementar `components/CardFornecedor.tsx`**

```tsx
import { linkWhatsApp, type Fornecedor } from '@/lib/fornecedores';

export function CardFornecedor({ fornecedor }: { fornecedor: Fornecedor }) {
  return (
    <div className="flex flex-col rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h3 className="font-display text-lg font-bold tracking-tight text-mata">{fornecedor.nome}</h3>
      <p className="mt-1 text-sm text-tinta/70">{fornecedor.oQueVende}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{fornecedor.municipio}</p>
      <a
        href={linkWhatsApp(fornecedor.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-pasto px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Chamar no WhatsApp
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `components/VitrineFornecedores.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { CATEGORIAS, agruparPorCategoria, type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { CardFornecedor } from '@/components/CardFornecedor';

export function VitrineFornecedores({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [categoria, setCategoria] = useState<CategoriaFornecedor | null>(null);

  if (fornecedores.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
        <p className="font-display text-lg font-bold text-mata">Vitrine em breve — estamos reunindo os fornecedores da praça.</p>
        <p className="mt-1 text-sm text-tinta/50">Volte logo: a lista da praça está sendo montada.</p>
      </div>
    );
  }

  const grupos = agruparPorCategoria(fornecedores, categoria);
  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto ${
      ativo ? 'bg-mata text-white' : 'border border-linha bg-papel text-tinta/60 hover:bg-linha/60'
    }`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategoria(null)} className={chip(categoria === null)}>
          Todas
        </button>
        {CATEGORIAS.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategoria(c.id)} className={chip(categoria === c.id)}>
            {c.rotulo}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhum fornecedor nesta categoria ainda.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {grupos.map((g) => (
            <section key={g.categoria}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">{g.rotulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.fornecedores.map((f) => (
                  <CardFornecedor key={`${f.nome}-${f.municipio}`} fornecedor={f} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implementar `app/fornecedores/page.tsx`**

```tsx
import { FORNECEDORES } from '@/lib/fornecedores';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';

export const metadata = { title: 'Fornecedores — Praça Araguaia' };

export default function Fornecedores() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Quem atende a praça</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Fornecedores da praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Agropecuárias, revendas e prestadores da região do Araguaia — fale direto no WhatsApp.
      </p>
      <VitrineFornecedores fornecedores={FORNECEDORES} />
    </main>
  );
}
```

- [ ] **Step 6: Acrescentar o link no Header**

Em `components/Header.tsx`, adicionar ao array `LINKS` (após `Termômetro`):

```tsx
  { href: '/fornecedores', rotulo: 'Fornecedores' },
```

- [ ] **Step 7: Testes, build e lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: toda a suíte PASS (177 + os novos), build e lint limpos. A página `/fornecedores` aparece como **estática** (○) no build.

- [ ] **Step 8: Commit**

```bash
git add components/CardFornecedor.tsx components/VitrineFornecedores.tsx app/fornecedores/page.tsx components/Header.tsx tests/components/CardFornecedor.test.tsx tests/components/VitrineFornecedores.test.tsx
git commit -m "feat: pagina de fornecedores com filtro por categoria e link wa.me"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch (opus) — padrão das fatias anteriores.
2. E2E local: `/fornecedores` mostra "em breve" com a lista vazia; com um fixture temporário (não commitado), conferir chips filtrando, seções por categoria e o link `wa.me` correto no card; confirmar o item "Fornecedores" no Header. Reverter o fixture.
3. Push com aprovação → deploy; verificação em produção (página no ar com "em breve", link no menu).
4. Atualizar `ESTADO-DO-PROJETO.md` (fatia 12) e memória. Lembrar o usuário de enviar os fornecedores reais (nome, categoria, município, WhatsApp com DDD) para o commit de conteúdo.

## Self-Review (feito)

- **Cobertura da spec:** dados+`linkWhatsApp`+`agruparPorCategoria`+invariante (Task 1); card com wa.me seguro, vitrine com chips+estado vazio+filtro-vazio, página estática, link no Header (Task 2); testes de lógica e de componentes; página por build+e2e. ✔
- **Placeholders:** nenhum — todo passo traz o código real. ✔
- **Consistência de tipos:** `Fornecedor`/`CategoriaFornecedor`/`CATEGORIAS`/`linkWhatsApp`/`agruparPorCategoria` idênticos entre Task 1 (definição) e Task 2 (consumo); mensagens de estado vazio e filtro-vazio idênticas entre spec, plano e testes. ✔
