# P2 — Home sparklines — Implementation Plan

> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cada card da home mostra uma mini-tendência (sparkline) de 30 dias.

**Architecture:** Helper puro `caminhoSparkline` → componente `Sparkline` (SVG) → prop opcional `historico` no `CardCotacao` → home busca `cotacoes_historico` e passa por tipo.

## Global Constraints
- Zero dependências novas (SVG puro). `historico` opcional (não quebra telas atuais).

---

### Task 1: `lib/sparkline.ts` (puro)

**Files:** Create `lib/sparkline.ts`, `tests/sparkline.test.ts`.

- [ ] **Step 1: Teste** (`tests/sparkline.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { caminhoSparkline } from '@/lib/sparkline';

describe('caminhoSparkline', () => {
  it('menos de 2 valores → vazio', () => {
    expect(caminhoSparkline([], 90, 30)).toBe('');
    expect(caminhoSparkline([5], 90, 30)).toBe('');
  });
  it('valor maior fica no topo (y menor)', () => {
    expect(caminhoSparkline([1, 2, 3], 90, 30)).toBe('0,30 45,15 90,0');
  });
  it('valores iguais → reta no meio', () => {
    expect(caminhoSparkline([2, 2], 90, 30)).toBe('0,15 90,15');
  });
});
```

- [ ] **Step 2: Rodar → FAIL.** `npx vitest run tests/sparkline.test.ts`

- [ ] **Step 3: Implementar** (`lib/sparkline.ts`):

```ts
// Pontos de uma <polyline> SVG (sparkline). Valor maior → y menor (linha sobe).
// Menos de 2 valores → vazio. Valores iguais → reta no meio.
export function caminhoSparkline(valores: number[], largura: number, altura: number): string {
  if (valores.length < 2) return '';
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const range = max - min;
  const n = valores.length;
  const arred = (v: number) => Math.round(v * 100) / 100;
  return valores
    .map((v, i) => {
      const x = arred((i / (n - 1)) * largura);
      const y = arred(range === 0 ? altura / 2 : altura - ((v - min) / range) * altura);
      return `${x},${y}`;
    })
    .join(' ');
}
```

- [ ] **Step 4: Rodar → PASS.** **Step 5: Commit.**

---

### Task 2: `Sparkline` + `CardCotacao` + home

**Files:** Create `components/Sparkline.tsx`, `tests/components/Sparkline.test.tsx`; Modify `components/CardCotacao.tsx`, `app/page.tsx`; add case em `tests/components/CardCotacao.test.tsx`.

**Interfaces:** `<Sparkline valores={number[]} />`; `CardCotacao` ganha `historico?: number[]`.

- [ ] **Step 1: Testes (falhando)** — `tests/components/Sparkline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/Sparkline';

describe('Sparkline', () => {
  it('renderiza uma polyline com ≥2 valores', () => {
    const { container } = render(<Sparkline valores={[1, 2, 3]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
  it('não renderiza nada com <2 valores', () => {
    const { container } = render(<Sparkline valores={[1]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('cor verde quando sobe, vermelha quando cai', () => {
    const up = render(<Sparkline valores={[1, 3]} />).container.querySelector('polyline');
    expect(up?.getAttribute('stroke')).toBe('#059669');
    const down = render(<Sparkline valores={[3, 1]} />).container.querySelector('polyline');
    expect(down?.getAttribute('stroke')).toBe('#dc2626');
  });
});
```

E adicionar em `tests/components/CardCotacao.test.tsx`:

```tsx
  it('mostra o sparkline quando recebe historico com ≥2 pontos', () => {
    const { container } = render(
      <CardCotacao titulo="Dólar" valor={5.43} unidade="R$" variacaoPct={1.2}
        dataReferencia="2026-06-19T12:00:00.000Z" desatualizado={false} historico={[5.1, 5.2, 5.43]} />
    );
    expect(container.querySelector('svg polyline')).toBeTruthy();
  });
```

- [ ] **Step 2: Rodar → FAIL.**

- [ ] **Step 3: `components/Sparkline.tsx`:**

```tsx
import { caminhoSparkline } from '@/lib/sparkline';

const LARGURA = 100;
const ALTURA = 32;

export function Sparkline({ valores }: { valores: number[] }) {
  const pontos = caminhoSparkline(valores, LARGURA, ALTURA);
  if (!pontos) return null;
  const subiu = valores[valores.length - 1] >= valores[0];
  const cor = subiu ? '#059669' : '#dc2626'; // emerald-600 / red-600 — mesma semântica da seta
  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} width="100%" height={ALTURA} preserveAspectRatio="none" aria-hidden="true" className="mt-3 block">
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
```

- [ ] **Step 4: `components/CardCotacao.tsx`** — adicionar `historico?: number[]` ao tipo e renderizar o sparkline entre o valor e a data:

Import: `import { Sparkline } from '@/components/Sparkline';`
Tipo: `historico?: number[];`
Assinatura: incluir `historico` no destructuring.
Após o `<p>` do valor:
```tsx
      {historico && historico.length >= 2 && <Sparkline valores={historico} />}
```

- [ ] **Step 5: `app/page.tsx`** — buscar histórico e passar por tipo:

Depois do fetch de `cotacoes`, adicionar:
```tsx
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hist } = await supabase
    .from('cotacoes_historico')
    .select('tipo, valor, data_referencia')
    .gte('data_referencia', desde)
    .order('data_referencia', { ascending: true });
  const historicoPorTipo = new Map<string, number[]>();
  for (const h of hist ?? []) {
    const arr = historicoPorTipo.get(h.tipo as string) ?? [];
    arr.push(Number(h.valor));
    historicoPorTipo.set(h.tipo as string, arr);
  }
```
`CardLink` ganha `historico?: number[]` e repassa ao `CardCotacao`; nas duas listas passar `historico={historicoPorTipo.get(c.tipo)}`.

- [ ] **Step 6: Rodar testes do card+sparkline → PASS. Step 7: suíte + lint + build. Step 8: Commit + push.**

## Verificação pós-deploy
Screenshot mobile+desktop da home: cada card com a mini-linha; desktop menos "vazio".
