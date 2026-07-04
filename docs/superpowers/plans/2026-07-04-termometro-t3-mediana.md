# Termômetro T3 (sub-fatia 1) — Mediana + Faixa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a média simples do `/termometro` por mediana ("valor típico") + faixa (min–max), para que um preço absurdo deixe de distorcer o número.

**Architecture:** Lógica pura em `lib/termometro.ts` (novo helper `mediana`, `ResumoProduto` com `mediana`/`faixa` no lugar de `media`); `CardTermometro.tsx` exibe o valor típico + linha de faixa condicional; `app/termometro/page.tsx` só acompanha a mudança de tipo. Sem banco, deps, PII ou rotas.

**Tech Stack:** TypeScript strict, Vitest + Testing Library, Tailwind v4 (tokens do projeto), Next 15.

## Global Constraints

- Zero dependências novas. Sem migração, sem env nova, sem rotas.
- Mediana arredondada a **2 casas** (par: média dos dois valores centrais). Mesma precisão da média atual.
- `faixa = { min: Math.min(valores), max: Math.max(valores) }` sobre os valores reportados (já dentro da faixa plausível). Não é desvio/IC.
- A linha de faixa no card aparece **apenas quando** `contagem >= 2` **e** `faixa.min !== faixa.max`.
- Etiqueta do número grande: **"valor típico"**. A linha CONAB permanece **"média CONAB: X"** (rótulo inalterado).
- `resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[]` mantém assinatura, ordem (`ORDEM_PRODUTOS`) e o descarte de produtos sem reportes.
- Formatação pt-BR com o mesmo `Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })`.
- Textos de UI em português brasileiro.

---

### Task 1: Mediana + faixa na lógica pura (`lib/termometro.ts`)

**Files:**
- Modify: `lib/termometro.ts` (helper `mediana`, tipo `ResumoProduto`, corpo de `resumirReportes`; remover o helper `media2` se ficar sem uso)
- Test: `tests/termometro.test.ts` (atualizar o bloco `resumirReportes`)

**Interfaces:**
- Consumes: `ReporteAprovado = { produto: string; municipio: string; valor: number }`, `ORDEM_PRODUTOS`, `PRODUTOS`, `MUNICIPIOS_TERMOMETRO` (já existentes).
- Produces (consumido pela Task 2):
  - `export function mediana(valores: number[]): number` — mediana de lista NÃO vazia, 2 casas.
  - `ResumoProduto = { produto: ProdutoTermometro; rotulo: string; unidade: string; mediana: number; faixa: { min: number; max: number }; contagem: number; municipios: { municipio: string; mediana: number; contagem: number }[] }`

- [ ] **Step 1: Atualizar os testes de `resumirReportes` (falhando)**

Em `tests/termometro.test.ts`, substituir o bloco `describe('resumirReportes', ...)` (linhas 48–74) por:

```ts
describe('mediana', () => {
  it('valor central em contagem ímpar', () => {
    expect(mediana([310, 320, 900])).toBe(320);
  });
  it('média dos dois centrais em contagem par, 2 casas', () => {
    expect(mediana([300, 310, 320, 331])).toBe(315);
    expect(mediana([50, 51])).toBe(50.5);
  });
  it('um elemento é ele mesmo; repetidos ok', () => {
    expect(mediana([320])).toBe(320);
    expect(mediana([320, 320, 320])).toBe(320);
  });
  it('não depende da ordem de entrada', () => {
    expect(mediana([900, 310, 320])).toBe(320);
  });
});

describe('resumirReportes', () => {
  const r = (produto: string, municipio: string, valor: number) => ({ produto, municipio, valor });

  it('agrega mediana regional (imune a um extremo) e faixa, na ordem fixa', () => {
    const resumo = resumirReportes([
      r('soja', 'Vila Rica', 110),
      r('boi', 'Redenção', 300),
      r('boi', 'Redenção', 310),
      r('boi', 'Confresa', 320),
      r('boi', 'Confresa', 330),
      r('boi', 'Vila Rica', 900), // extremo: puxaria a média para ~432
    ]);
    expect(resumo.map((x) => x.produto)).toEqual(['boi', 'soja']); // ordem fixa, sem produtos vazios
    expect(resumo[0]).toMatchObject({ rotulo: 'Boi gordo', unidade: 'R$/@', mediana: 315, contagem: 5 });
    expect(resumo[0].faixa).toEqual({ min: 300, max: 900 });
  });

  it('mediana por município e contagem', () => {
    const resumo = resumirReportes([
      r('boi', 'Redenção', 320),
      r('boi', 'Redenção', 330),
      r('boi', 'Confresa', 310),
    ]);
    expect(resumo[0].municipios).toEqual([
      { municipio: 'Redenção', mediana: 325, contagem: 2 },
      { municipio: 'Confresa', mediana: 310, contagem: 1 },
    ]);
  });

  it('um reporte: mediana = valor, faixa degenerada', () => {
    const resumo = resumirReportes([r('milho', 'Vila Rica', 50)]);
    expect(resumo[0]).toMatchObject({ mediana: 50, contagem: 1 });
    expect(resumo[0].faixa).toEqual({ min: 50, max: 50 });
  });

  it('lista vazia devolve vazio', () => {
    expect(resumirReportes([])).toEqual([]);
  });
});
```

E atualizar o import no topo do arquivo (linha 2) para incluir `mediana`:

```ts
import { validarReporte, resumirReportes, mediana, normalizarValor, PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO } from '@/lib/termometro';
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/termometro.test.ts`
Expected: FAIL — `mediana` não existe / `ResumoProduto` ainda tem `media`.

- [ ] **Step 3: Implementar em `lib/termometro.ts`**

Substituir o helper `media2` e o tipo/corpo relacionados. O `ResumoProduto` (linhas 59–66 do arquivo atual) e o `media2` + `resumirReportes` (linhas 68–91) passam a:

```ts
export type ResumoProduto = {
  produto: ProdutoTermometro;
  rotulo: string;
  unidade: string;
  mediana: number;
  faixa: { min: number; max: number };
  contagem: number;
  municipios: { municipio: string; mediana: number; contagem: number }[];
};

// Mediana de uma lista NÃO vazia, arredondada a 2 casas (par: média dos dois centrais).
export function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const bruta =
    ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
  return Math.round(bruta * 100) / 100;
}

// Agrega reportes JÁ filtrados (aprovados, últimos 7 dias — responsabilidade da query).
export function resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[] {
  return ORDEM_PRODUTOS.flatMap((produto) => {
    const doProduto = reportes.filter((r) => r.produto === produto);
    if (doProduto.length === 0) return [];
    const valores = doProduto.map((r) => r.valor);
    const municipios = MUNICIPIOS_TERMOMETRO.flatMap((municipio) => {
      const doMunicipio = doProduto.filter((r) => r.municipio === municipio).map((r) => r.valor);
      return doMunicipio.length === 0
        ? []
        : [{ municipio, mediana: mediana(doMunicipio), contagem: doMunicipio.length }];
    });
    return [
      {
        produto,
        rotulo: PRODUTOS[produto].rotulo,
        unidade: PRODUTOS[produto].unidade,
        mediana: mediana(valores),
        faixa: { min: Math.min(...valores), max: Math.max(...valores) },
        contagem: doProduto.length,
        municipios,
      },
    ];
  });
}
```

Observação: o helper antigo `const media2 = ...` deve ser removido (fica sem uso). Manter tudo acima de `ReporteAprovado`/`ResumoProduto` intacto.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/termometro.test.ts`
Expected: PASS (todos os blocos: `validarReporte`, `mediana`, `resumirReportes`, `normalizarValor`, `constantes`).

- [ ] **Step 5: Commit**

```bash
git add lib/termometro.ts tests/termometro.test.ts
git commit -m "feat: termometro agrega por mediana + faixa no lugar da media"
```

---

### Task 2: Exibir valor típico + faixa (`CardTermometro.tsx`)

**Files:**
- Modify: `components/CardTermometro.tsx`
- Modify: `app/termometro/page.tsx` (só a montagem do objeto passado, se necessário — ver Step 3)
- Test: `tests/components/CardTermometro.test.tsx`

**Interfaces:**
- Consumes (Task 1): `ResumoProduto` com `mediana`, `faixa: { min, max }`, `municipios[].mediana`.
- Produces: nenhum (fatia final).

- [ ] **Step 1: Atualizar os testes do card (falhando)**

Substituir todo o conteúdo de `tests/components/CardTermometro.test.tsx` por:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardTermometro } from '@/components/CardTermometro';
import type { ResumoProduto } from '@/lib/termometro';

const resumo: ResumoProduto = {
  produto: 'boi', rotulo: 'Boi gordo', unidade: 'R$/@', mediana: 325.5,
  faixa: { min: 300, max: 360 }, contagem: 3,
  municipios: [
    { municipio: 'Redenção', mediana: 330, contagem: 2 },
    { municipio: 'Confresa', mediana: 316.5, contagem: 1 },
  ],
};

describe('CardTermometro', () => {
  it('mostra rótulo, valor típico (mediana), etiqueta, contagem e municípios', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('325,5')).toBeInTheDocument();
    expect(screen.getByText('valor típico')).toBeInTheDocument();
    expect(screen.getByText('3 reportes · últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Redenção')).toBeInTheDocument();
    expect(screen.getByText(/316,5/)).toBeInTheDocument();
  });

  it('mostra a faixa quando há 2+ reportes com dispersão', () => {
    render(<CardTermometro resumo={resumo} />);
    expect(screen.getByText(/faixa: R\$ 300–360/)).toBeInTheDocument();
  });

  it('não mostra a faixa com 1 reporte', () => {
    render(<CardTermometro resumo={{ ...resumo, contagem: 1, faixa: { min: 325.5, max: 325.5 }, municipios: [] }} />);
    expect(screen.getByText('1 reporte · últimos 7 dias')).toBeInTheDocument();
    expect(screen.queryByText(/faixa:/)).not.toBeInTheDocument();
  });

  it('não mostra a faixa quando min == max (todos iguais)', () => {
    render(<CardTermometro resumo={{ ...resumo, faixa: { min: 320, max: 320 } }} />);
    expect(screen.queryByText(/faixa:/)).not.toBeInTheDocument();
  });

  it('mostra o contraste com a média CONAB quando informada', () => {
    render(<CardTermometro resumo={resumo} mediaConab={326.96} />);
    expect(screen.getByText(/média CONAB: 326,96/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/CardTermometro.test.tsx`
Expected: FAIL — `resumo.media` não existe mais; "valor típico" e "faixa:" ausentes.

- [ ] **Step 3: Implementar em `components/CardTermometro.tsx`**

Substituir todo o arquivo por:

```tsx
import type { ResumoProduto } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function CardTermometro({ resumo, mediaConab }: { resumo: ResumoProduto; mediaConab?: number }) {
  const mostrarFaixa = resumo.contagem >= 2 && resumo.faixa.min !== resumo.faixa.max;
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{resumo.rotulo}</h2>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{resumo.unidade}</p>
      <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-tinta">{fmt.format(resumo.mediana)}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-tinta/50">valor típico</p>
      <p className="mt-1 text-xs text-tinta/40">
        {resumo.contagem} {resumo.contagem === 1 ? 'reporte' : 'reportes'} · últimos 7 dias
      </p>
      {mostrarFaixa && (
        <p className="mt-1 text-xs text-tinta/50">
          faixa: R$ {fmt.format(resumo.faixa.min)}–{fmt.format(resumo.faixa.max)}
        </p>
      )}
      {mediaConab !== undefined && (
        <p className="mt-1 text-xs text-tinta/50">média CONAB: {fmt.format(mediaConab)}</p>
      )}
      {resumo.municipios.length > 0 && (
        <ul className="mt-4 divide-y divide-linha/70 border-t border-linha/70">
          {resumo.municipios.map((m) => (
            <li key={m.municipio} className="flex items-baseline justify-between gap-2 py-1.5 text-sm tabular-nums">
              <span className="text-tinta/60">{m.municipio}</span>
              <span className="text-tinta/80">
                {fmt.format(m.mediana)} <span className="text-xs text-tinta/40">({m.contagem})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Conferir `app/termometro/page.tsx`**

O `page.tsx` monta `resumirReportes(...)` e passa `<CardTermometro resumo={r} mediaConab={conab.get(r.produto)} />`. Como `resumo` agora tem `mediana`/`faixa` e o card lê direto do objeto, **nenhuma mudança de código é necessária** — apenas confirmar que o arquivo compila com o novo tipo.

Run: `npx tsc --noEmit`
Expected: sem erros de tipo em `app/termometro/page.tsx` nem em outros consumidores. (Se `tsc` apontar algum uso remanescente de `.media`, corrigir para `.mediana` no ponto indicado.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/components/CardTermometro.test.tsx`
Expected: PASS.

- [ ] **Step 6: Suíte completa + build + lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: todos os testes PASS (a suíte inteira, ~165), build e lint limpos.

- [ ] **Step 7: Commit**

```bash
git add components/CardTermometro.tsx tests/components/CardTermometro.test.tsx app/termometro/page.tsx
git commit -m "feat: card do termometro mostra valor tipico (mediana) + faixa"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch (fable/opus) — padrão das fatias anteriores.
2. E2E local rápido: subir o dev server, popular 3–4 reportes aprovados de um produto (incluindo um extremo), abrir `/termometro`, screenshot confirmando a mediana (não puxada pelo extremo) + a linha de faixa. Limpar os dados de teste (escopar o `delete` por id — `delete` sem predicado é barrado).
3. Push com aprovação do usuário → deploy automático; verificação em produção; limpeza.
4. Atualizar `ESTADO-DO-PROJETO.md` (fatia 10) e memória.

## Self-Review (feito)

- **Cobertura da spec:** mediana (Task 1), faixa min–max (Task 1), etiqueta "valor típico" + faixa condicional + CONAB inalterado (Task 2), por-município mediana (Tasks 1 e 2), casos de borda 1 reporte / min==max (testes das duas tasks). ✔
- **Placeholders:** nenhum — todo passo traz o código real. ✔
- **Consistência de tipos:** `mediana`/`faixa`/`municipios[].mediana` idênticos entre Task 1 (definição), Task 2 (consumo) e os testes. `media2` removido. ✔
