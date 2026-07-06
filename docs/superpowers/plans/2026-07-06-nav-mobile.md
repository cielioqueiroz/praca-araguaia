# P1 — Navegação mobile — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax.

**Goal:** No celular, header enxuto com botão ☰ que abre uma gaveta com os 6 itens; desktop inalterado; página atual destacada.

**Architecture:** Extrair a navegação do `Header` (server) para um novo `NavPrincipal` (client) que faz o toggle da gaveta e o realce do item ativo via `usePathname`.

**Tech Stack:** Next.js App Router, React client component, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Zero dependências novas. UI em pt-BR. Desktop idêntico ao atual.
- Breakpoint `sm` (640px): `<640` mobile (hambúrguer), `≥640` desktop (inline).
- `focus-visible` e `aria-*` seguindo o padrão do projeto.

---

### Task 1: `NavPrincipal` (client) + refactor do `Header`

**Files:**
- Create: `components/NavPrincipal.tsx`
- Modify: `components/Header.tsx`
- Test: `tests/components/NavPrincipal.test.tsx`

**Interfaces:**
- Produces: `<NavPrincipal />` (client) — sem props; lê a rota via `usePathname`.

- [ ] **Step 1: Escrever o teste (falhando)** — `tests/components/NavPrincipal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/chuva' }));

import { NavPrincipal } from '@/components/NavPrincipal';

beforeEach(() => vi.restoreAllMocks());

describe('NavPrincipal', () => {
  it('renderiza os 6 itens do menu', () => {
    render(<NavPrincipal />);
    for (const rotulo of ['Cotações', 'Boletim', 'Chuva', 'Termômetro', 'Fornecedores', 'Calculadora']) {
      expect(screen.getAllByRole('link', { name: rotulo }).length).toBeGreaterThan(0);
    }
  });

  it('marca a rota atual com aria-current=page', () => {
    render(<NavPrincipal />);
    const chuva = screen.getAllByRole('link', { name: 'Chuva' })[0];
    expect(chuva).toHaveAttribute('aria-current', 'page');
    const boletim = screen.getAllByRole('link', { name: 'Boletim' })[0];
    expect(boletim).not.toHaveAttribute('aria-current');
  });

  it('o botão hambúrguer abre e fecha a gaveta', () => {
    render(<NavPrincipal />);
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicar num item da gaveta fecha o menu', () => {
    render(<NavPrincipal />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const gaveta = document.getElementById('menu-mobile') as HTMLElement;
    const linkChuva = gaveta.querySelector('a') as HTMLElement;
    fireEvent.click(linkChuva);
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar** — `npx vitest run tests/components/NavPrincipal.test.tsx` → FAIL (componente não existe).

- [ ] **Step 3: Implementar `components/NavPrincipal.tsx`**:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', rotulo: 'Cotações' },
  { href: '/boletim', rotulo: 'Boletim' },
  { href: '/chuva', rotulo: 'Chuva' },
  { href: '/termometro', rotulo: 'Termômetro' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

function estaAtivo(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function NavPrincipal() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  const linkClasses = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 font-medium transition focus-visible:outline-2 focus-visible:outline-white ${
      ativo ? 'bg-white/15 text-white' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <>
      {/* Desktop: menu inline */}
      <nav className="hidden flex-wrap justify-end gap-1 text-sm sm:flex">
        {LINKS.map((l) => {
          const ativo = estaAtivo(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} className={linkClasses(ativo)} aria-current={ativo ? 'page' : undefined}>
              {l.rotulo}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: botão + gaveta */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        aria-controls="menu-mobile"
        className="rounded-md p-1.5 text-white focus-visible:outline-2 focus-visible:outline-white sm:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {aberto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {aberto && (
        <nav id="menu-mobile" className="mt-3 flex w-full basis-full flex-col gap-1 text-base sm:hidden">
          {LINKS.map((l) => {
            const ativo = estaAtivo(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                aria-current={ativo ? 'page' : undefined}
                className={`rounded-lg px-3 py-2.5 font-medium transition focus-visible:outline-2 focus-visible:outline-white ${
                  ativo ? 'bg-white/15 text-white' : 'text-emerald-100/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                {l.rotulo}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
```

- [ ] **Step 4: Refatorar `components/Header.tsx`** para usar o `NavPrincipal` (remove os `LINKS` e a `<nav>` de lá):

```tsx
import Link from 'next/link';
import { NavPrincipal } from '@/components/NavPrincipal';

export function Header() {
  return (
    <header className="bg-mata text-palha">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-y-2 px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#15803d" />
            <line x1="16" y1="25.5" x2="16" y2="13" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M16 17.5c-.7-3.6-3.5-5.6-7.2-5.6-.4 3.9 2.5 6.8 7.2 6.8z" fill="#bbf7d0" />
            <path d="M16 14.2c.7-3.6 3.5-5.6 7.2-5.6.4 3.9-2.5 6.8-7.2 6.8z" fill="#ffffff" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight">Praça Araguaia</span>
        </Link>
        <NavPrincipal />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Rodar os testes** — `npx vitest run tests/components/NavPrincipal.test.tsx` → PASS (4 testes).

- [ ] **Step 6: Suíte + lint + build** — `npx vitest run` (todos), `npm run lint` (limpo), `npm run build` (OK).

- [ ] **Step 7: Commit** — `git add components/NavPrincipal.tsx components/Header.tsx tests/components/NavPrincipal.test.tsx && git commit`.

## Verificação pós-deploy

Screenshot mobile (iPhone) de `/` e `/chuva`: topo com logo + ☰ numa linha; tocar abre a gaveta; item da página atual realçado. Desktop inalterado.
