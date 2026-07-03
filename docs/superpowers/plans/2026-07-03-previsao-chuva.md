# Previsão de Chuva por Município — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/chuva` com previsão de 7 dias (chuva mm, probabilidade, temperaturas) para 5 municípios da região via Open-Meteo, sem banco/cron, com link no painel.

**Architecture:** Fonte pura `lib/fontes/chuva.ts` (1 chamada multi-coordenada à Open-Meteo, cache `revalidate: 3600` do Next); card puro `components/CardChuva.tsx`; página Server Component `/chuva` que captura falha da API com mensagem amigável.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Vitest + Testing Library. Zero dependências novas.

**Spec:** `docs/superpowers/specs/2026-07-03-previsao-chuva-design.md`

## Global Constraints

- TypeScript **strict**; **zero dependências novas**; textos de UI em pt-BR.
- Municípios fixos, nesta ordem (coordenadas validadas no geocoding em 2026-07-03): Redenção/PA (-8.02861, -50.03139), Santana do Araguaia/PA (-9.335, -50.35), Vila Rica/MT (-10.01167, -51.11639), Confresa/MT (-10.64389, -51.56889), São Félix do Araguaia/MT (-11.61722, -50.66944).
- API (validada por chamada real): `https://api.open-meteo.com/v1/forecast?latitude=<lats separadas por vírgula>&longitude=<lons>&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FAraguaina&forecast_days=7` → **array** de objetos na **mesma ordem** do request (a resposta não traz nome — mapear por índice); `daily.time[7]` etc.; `precipitation_probability_max` pode ser `null`.
- Fonte segue o padrão do projeto: `fetchImpl: typeof fetch = fetch` injetável; fetch com `next: { revalidate: 3600 }` (1 chamada/hora).
- Página `/chuva` **sem** `dynamic = 'force-dynamic'` (o cache do fetch é o comportamento desejado).
- Open-Meteo falhou → página mostra "Previsão indisponível no momento. Tente mais tarde." (sem 500).
- Destaque de chuva forte: `chuvaMm >= 10` (constante `CHUVA_FORTE_MM = 10`).
- Testes: Vitest, `describe/it` em pt-BR, em `tests/` espelhando a estrutura.
- **NUNCA rode `git push` antes da Task 4** (push na `master` = deploy; o push precisa de aprovação do usuário).

---

### Task 1: Fonte Open-Meteo (`lib/fontes/chuva.ts`)

**Files:**
- Create: `lib/fontes/chuva.ts`
- Test: `tests/fontes/chuva.test.ts`

**Interfaces:**
- Consumes: nada do projeto (fonte independente).
- Produces (Tasks 2–3 consomem):
  - `MUNICIPIOS: readonly { nome, uf, lat, lon }[]`
  - `type DiaPrevisao = { data: string; chuvaMm: number; probMax: number | null; tempMin: number; tempMax: number }`
  - `type PrevisaoMunicipio = { municipio: string; uf: string; dias: DiaPrevisao[] }`
  - `buscarPrevisao(fetchImpl?: typeof fetch): Promise<PrevisaoMunicipio[]>`

- [ ] **Step 1: Write the failing tests**

Criar `tests/fontes/chuva.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buscarPrevisao, MUNICIPIOS } from '@/lib/fontes/chuva';

const DIAS = ['2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'];

const diario = () => ({
  time: DIAS,
  precipitation_sum: [0, 1.5, 12.3, 0, 0, 4.2, 0],
  precipitation_probability_max: [0, 45, 90, null, 10, 60, 20],
  temperature_2m_max: [33.5, 34, 35, 33, 32, 31, 30],
  temperature_2m_min: [19.9, 20, 21, 19, 18, 17, 16],
});

const FIXTURE = Array.from({ length: 5 }, () => ({ daily: diario() }));

function fetchComJson(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;
}

describe('buscarPrevisao', () => {
  it('monta os 5 municípios na ordem da lista fixa', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p.map((x) => x.municipio)).toEqual(MUNICIPIOS.map((m) => m.nome));
    expect(p[0]).toMatchObject({ municipio: 'Redenção', uf: 'PA' });
    expect(p[4]).toMatchObject({ municipio: 'São Félix do Araguaia', uf: 'MT' });
  });

  it('mapeia os 7 dias com chuva, probabilidade e temperaturas', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p[0].dias).toHaveLength(7);
    expect(p[0].dias[2]).toEqual({ data: '2026-07-05', chuvaMm: 12.3, probMax: 90, tempMin: 21, tempMax: 35 });
  });

  it('preserva probabilidade null (dias distantes sem dado)', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p[0].dias[3].probMax).toBeNull();
  });

  it('faz uma única chamada com todas as coordenadas', async () => {
    const f = fetchComJson(FIXTURE);
    await buscarPrevisao(f);
    expect(f).toHaveBeenCalledTimes(1);
    const url = String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain('-8.02861');
    expect(url).toContain('-11.61722');
    expect(url).toContain('forecast_days=7');
  });

  it('rejeita quando o HTTP não é ok', async () => {
    await expect(buscarPrevisao(fetchComJson({}, false, 500))).rejects.toThrow(/Open-Meteo/);
  });

  it('rejeita quando a quantidade de localidades não confere', async () => {
    await expect(buscarPrevisao(fetchComJson(FIXTURE.slice(0, 3)))).rejects.toThrow(/localidades/);
  });

  it('rejeita quando o daily vem ausente', async () => {
    const quebrado = [...FIXTURE.slice(0, 4), {}];
    await expect(buscarPrevisao(fetchComJson(quebrado))).rejects.toThrow(/São Félix/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/fontes/chuva.test.ts`
Expected: FAIL — `Cannot find module '@/lib/fontes/chuva'`.

- [ ] **Step 3: Write the implementation**

Criar `lib/fontes/chuva.ts`:

```ts
export type DiaPrevisao = {
  data: string; // yyyy-mm-dd
  chuvaMm: number;
  probMax: number | null; // pode faltar em dias distantes
  tempMin: number;
  tempMax: number;
};

export type PrevisaoMunicipio = { municipio: string; uf: string; dias: DiaPrevisao[] };

// Municípios da região do Araguaia (coordenadas do geocoding da Open-Meteo).
export const MUNICIPIOS = [
  { nome: 'Redenção', uf: 'PA', lat: -8.02861, lon: -50.03139 },
  { nome: 'Santana do Araguaia', uf: 'PA', lat: -9.335, lon: -50.35 },
  { nome: 'Vila Rica', uf: 'MT', lat: -10.01167, lon: -51.11639 },
  { nome: 'Confresa', uf: 'MT', lat: -10.64389, lon: -51.56889 },
  { nome: 'São Félix do Araguaia', uf: 'MT', lat: -11.61722, lon: -50.66944 },
] as const;

type RespostaLocal = {
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
};

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

// Uma chamada só para todos os municípios; a resposta vem na ordem do request.
export async function buscarPrevisao(fetchImpl: typeof fetch = fetch): Promise<PrevisaoMunicipio[]> {
  const url =
    `${URL_BASE}?latitude=${MUNICIPIOS.map((m) => m.lat).join(',')}` +
    `&longitude=${MUNICIPIOS.map((m) => m.lon).join(',')}` +
    '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
    '&timezone=America%2FAraguaina&forecast_days=7';

  // revalidate: o Next reusa a resposta por 1h entre renders da página.
  const res = await fetchImpl(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo respondeu ${res.status}`);

  const body = (await res.json()) as RespostaLocal[];
  if (!Array.isArray(body) || body.length !== MUNICIPIOS.length) {
    throw new Error('Resposta da Open-Meteo inválida: quantidade de localidades não confere');
  }

  return body.map((local, i) => {
    const d = local?.daily;
    if (!d?.time || !d.precipitation_sum || !d.temperature_2m_max || !d.temperature_2m_min) {
      throw new Error(`Resposta da Open-Meteo inválida para ${MUNICIPIOS[i].nome}: daily ausente`);
    }
    const dias = d.time.map((data, j) => ({
      data,
      chuvaMm: Number(d.precipitation_sum?.[j] ?? 0),
      probMax: d.precipitation_probability_max?.[j] ?? null,
      tempMin: Number(d.temperature_2m_min?.[j]),
      tempMax: Number(d.temperature_2m_max?.[j]),
    }));
    return { municipio: MUNICIPIOS[i].nome, uf: MUNICIPIOS[i].uf, dias };
  });
}
```

Nota: `next: { revalidate }` tipa sem cast — o Next estende `RequestInit` globalmente via `next-env.d.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/fontes/chuva.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — Expected: todos passam (90 existentes + 7 novos).

```bash
git add lib/fontes/chuva.ts tests/fontes/chuva.test.ts
git commit -m "feat: fonte Open-Meteo com previsao de 7 dias por municipio"
```

---

### Task 2: Componente `CardChuva`

**Files:**
- Create: `components/CardChuva.tsx`
- Test: `tests/components/CardChuva.test.tsx`

**Interfaces:**
- Consumes: `PrevisaoMunicipio` de `@/lib/fontes/chuva` (Task 1).
- Produces: `CardChuva({ previsao }: { previsao: PrevisaoMunicipio })` — card puro, sem fetch. A Task 3 renderiza um por município.

- [ ] **Step 1: Write the failing tests**

Criar `tests/components/CardChuva.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardChuva } from '@/components/CardChuva';
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

const dia = (data: string, chuvaMm: number, probMax: number | null) => ({
  data, chuvaMm, probMax, tempMin: 19.6, tempMax: 33.4,
});

const previsao: PrevisaoMunicipio = {
  municipio: 'Redenção',
  uf: 'PA',
  dias: [
    dia('2026-07-03', 0, 0),
    dia('2026-07-04', 1.5, 45),
    dia('2026-07-05', 12.3, 90),
    dia('2026-07-06', 0, null),
    dia('2026-07-07', 0, 10),
    dia('2026-07-08', 4.2, 60),
    dia('2026-07-09', 0, 20),
  ],
};

describe('CardChuva', () => {
  it('mostra município, UF e as 7 linhas de dias', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('Redenção · PA')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('destaca chuva forte (>= 10 mm) e não destaca chuva fraca', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('12,3 mm')).toHaveClass('font-semibold');
    expect(screen.getByText('1,5 mm')).not.toHaveClass('font-semibold');
  });

  it('mostra travessão quando a probabilidade é null', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra temperaturas mín–máx arredondadas', () => {
    render(<CardChuva previsao={previsao} />);
    expect(screen.getAllByText('20–33°C')).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/CardChuva.test.tsx`
Expected: FAIL — `Cannot find module '@/components/CardChuva'`.

- [ ] **Step 3: Write the implementation**

Criar `components/CardChuva.tsx`:

```tsx
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const CHUVA_FORTE_MM = 10;

export function CardChuva({ previsao }: { previsao: PrevisaoMunicipio }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        {previsao.municipio} · {previsao.uf}
      </h2>
      <ul className="mt-3 divide-y divide-neutral-100">
        {previsao.dias.map((dia) => (
          <li key={dia.data} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="w-10 capitalize text-neutral-500">
              {fmtDia.format(new Date(`${dia.data}T12:00:00Z`))}
            </span>
            <span className={dia.chuvaMm >= CHUVA_FORTE_MM ? 'font-semibold text-sky-700' : 'text-neutral-700'}>
              {dia.chuvaMm.toLocaleString('pt-BR')} mm
            </span>
            <span className="text-neutral-500">{dia.probMax === null ? '—' : `${dia.probMax}%`}</span>
            <span className="text-neutral-500">
              {Math.round(dia.tempMin)}–{Math.round(dia.tempMax)}°C
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/CardChuva.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — Expected: todos passam.

```bash
git add components/CardChuva.tsx tests/components/CardChuva.test.tsx
git commit -m "feat: componente CardChuva com 7 dias por municipio"
```

---

### Task 3: Página `/chuva` + link no painel

**Files:**
- Create: `app/chuva/page.tsx`
- Modify: `app/page.tsx` (o link do boletim vira um bloco com os dois links)

**Interfaces:**
- Consumes: `buscarPrevisao`, `PrevisaoMunicipio` (Task 1); `CardChuva` (Task 2).
- Produces: páginas finais. Sem teste unitário (padrão do projeto) — verificação por build + Task 4.

- [ ] **Step 1: Criar `app/chuva/page.tsx`**

```tsx
import Link from 'next/link';
import { buscarPrevisao, type PrevisaoMunicipio } from '@/lib/fontes/chuva';
import { CardChuva } from '@/components/CardChuva';

export const metadata = { title: 'Previsão de chuva — Praça Araguaia' };

export default async function Chuva() {
  let previsoes: PrevisaoMunicipio[] | null;
  try {
    previsoes = await buscarPrevisao();
  } catch {
    previsoes = null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">Previsão de chuva</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Próximos 7 dias na região do Araguaia — chuva, probabilidade e temperaturas.
      </p>

      {previsoes === null ? (
        <p className="mt-8 text-neutral-500">Previsão indisponível no momento. Tente mais tarde.</p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {previsoes.map((p) => (
            <CardChuva key={p.municipio} previsao={p} />
          ))}
        </section>
      )}

      <p className="mt-8 text-xs text-neutral-400">fonte: Open-Meteo</p>
    </main>
  );
}
```

(Sem `export const dynamic` — o cache de 1h do fetch é o comportamento desejado.)

- [ ] **Step 2: Atualizar o painel**

Em `app/page.tsx`, substituir o bloco atual do link do boletim:

```tsx
      <Link href="/boletim" className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
        Boletim do dia →
      </Link>
```

por:

```tsx
      <div className="mt-2 flex gap-4">
        <Link href="/boletim" className="text-sm font-medium text-emerald-700 hover:underline">
          Boletim do dia →
        </Link>
        <Link href="/chuva" className="text-sm font-medium text-emerald-700 hover:underline">
          Previsão de chuva →
        </Link>
      </div>
```

- [ ] **Step 3: Verify — suite, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde; o build lista a rota `/chuva`.

- [ ] **Step 4: Commit**

```bash
git add app/chuva/page.tsx app/page.tsx
git commit -m "feat: pagina /chuva com previsao por municipio e link no painel"
```

---

### Task 4: Verificação ponta a ponta + deploy

**Files:**
- Modify: `ESTADO-DO-PROJETO.md` (fatia 6 em "O que já está pronto"; remover previsão de chuva de "O que falta"; atualizar contagem de testes)

**Interfaces:**
- Consumes: tudo das Tasks 1–3.
- Produces: página no ar em produção.

- [ ] **Step 1: Página real no dev server (Open-Meteo de verdade)**

Subir `npm run dev` em background e (PowerShell):

```powershell
curl.exe -s --retry 20 --retry-connrefused --retry-delay 2 http://localhost:3000/ | Out-Null
$html = curl.exe -s http://localhost:3000/chuva | Out-String
"Municipios: " + ((@('Redenção','Santana do Araguaia','Vila Rica','Confresa','São Félix do Araguaia') | Where-Object { $html.Contains($_) }).Count) + "/5"
"Fonte: $($html.Contains('Open-Meteo'))"
```

Expected: `Municipios: 5/5` e fonte presente. Encerrar o dev server ao final.

- [ ] **Step 2: Atualizar `ESTADO-DO-PROJETO.md` e commitar**

Adicionar em "O que já está pronto":

```markdown
### Fatia 6 — Previsão de chuva
- `/chuva`: 7 dias (chuva mm, probabilidade, temp mín–máx) para Redenção/PA, Santana do Araguaia/PA, Vila Rica/MT, Confresa/MT e São Félix do Araguaia/MT.
- Open-Meteo (grátis, sem chave), 1 chamada multi-coordenada com cache de 1h (`next: { revalidate: 3600 }`); sem banco/cron. Falha da API → mensagem amigável.
- `lib/fontes/chuva.ts` (fonte pura) + `components/CardChuva.tsx`; dias com chuva ≥ 10 mm destacados.
```

Remover "Previsão de chuva" da lista "O que falta" e atualizar a contagem de testes.

```bash
git add ESTADO-DO-PROJETO.md
git commit -m "docs: estado do projeto com a fatia 6 (previsao de chuva)"
```

- [ ] **Step 3: Deploy (REQUER APROVAÇÃO DO USUÁRIO)**

Pedir autorização ao usuário e então: `git push origin master`

- [ ] **Step 4: Verificação em produção**

```powershell
$html = curl.exe -s https://agroapp-bay.vercel.app/chuva | Out-String
"Municipios: " + ((@('Redenção','Santana do Araguaia','Vila Rica','Confresa','São Félix do Araguaia') | Where-Object { $html.Contains($_) }).Count) + "/5"
```

Expected: 5/5; painel com o link "Previsão de chuva →".
