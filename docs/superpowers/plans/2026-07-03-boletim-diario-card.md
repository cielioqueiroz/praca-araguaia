# Boletim Diário em Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rota pública `/api/boletim` que gera um PNG 1080×1080 com as cotações do dia (marca Praça Araguaia) + página `/boletim` com botão de download + link no painel.

**Architecture:** View-model puro em `lib/boletim.ts` (ordenar/formatar — testável em unidade); rota `app/api/boletim/route.tsx` fina que lê `cotacoes` via client anon e renderiza `ImageResponse` (`next/og`, embutido no Next 15 — zero dependências novas); página estática `/boletim` que aponta para a rota.

**Tech Stack:** Next.js 15 (App Router), `next/og` (Satori), TypeScript strict, Supabase (anon), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-03-boletim-diario-card-design.md`

## Global Constraints

- TypeScript **strict**; **zero dependências novas** (`ImageResponse` vem de `next/og`, já embutido); textos em pt-BR.
- Card **1080×1080**; marca **"Praça Araguaia"** com o broto do favicon; rodapé "fontes: CONAB · BCB · BCE" + "agroapp-bay.vercel.app".
- Ordem das cotações = `ORDEM_PAINEL` de `lib/tipos-ui.ts` (boi, soja, milho, dolar, euro, ouro; desconhecidos ao fim); títulos = `TITULOS`; legenda "média MT/PA/TO/GO · CONAB" só nas commodities (= `LEGENDAS`).
- Cores: alta `#059669`, baixa `#dc2626`, verde da marca `#15803d`/`#14532d`.
- Data por extenso pt-BR com `timeZone: 'America/Araguaina'` (UTC-3 fixo — determinístico no serverless e nos testes).
- Rota pública (sem `CRON_SECRET` — dado público); `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- Satori: todo `div` com múltiplos filhos-elemento precisa de `display: 'flex'` explícito; estilos inline (sem Tailwind). A fonte default do `next/og` só tem peso regular — a hierarquia visual vem de tamanho e cor (limitação aceita no spec).
- Testes: Vitest, `describe/it` em pt-BR, em `tests/` espelhando `lib/`/`app/`. Rota testada com `next/og` e Supabase **mockados** (o PNG real é verificado ponta a ponta na Task 4).
- **NUNCA rode `git push` antes da Task 4** (push na `master` = deploy em produção; o push da Task 4 precisa de aprovação do usuário).

---

### Task 1: View-model do boletim (`lib/boletim.ts`)

**Files:**
- Create: `lib/boletim.ts`
- Test: `tests/boletim.test.ts`

**Interfaces:**
- Consumes: `TITULOS`, `ORDEM_PAINEL`, `LEGENDAS` de `@/lib/tipos-ui` (já existem).
- Produces (a Task 2 consome exatamente isto):
  - `type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null }`
  - `type ItemBoletim = { titulo: string; valorFmt: string; variacao?: { texto: string; direcao: 'alta' | 'baixa' }; legenda?: string }`
  - `type Boletim = { dataExtenso: string; itens: ItemBoletim[] }`
  - `montarBoletim(linhas: LinhaCotacao[], agora?: Date): Boletim`

- [ ] **Step 1: Write the failing tests**

Criar `tests/boletim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { montarBoletim } from '@/lib/boletim';

const linha = (tipo: string, valor: number, unidade: string, variacao_pct: number | null) => ({
  tipo, valor, unidade, variacao_pct,
});

describe('montarBoletim', () => {
  it('ordena pelo painel (commodities primeiro) e joga tipo desconhecido para o fim', () => {
    const b = montarBoletim([
      linha('dolar', 5.19, 'R$', 0.5),
      linha('xpto', 1, 'R$', null),
      linha('boi', 326.96, 'R$/@', -1.54),
    ]);
    expect(b.itens.map((i) => i.titulo)).toEqual(['Boi gordo', 'Dólar', 'xpto']);
  });

  it('formata valor pt-BR prefixado pela unidade', () => {
    const b = montarBoletim([linha('boi', 326.96, 'R$/@', null), linha('dolar', 5.1945, 'R$', null)]);
    expect(b.itens[0].valorFmt).toBe('R$/@ 326,96');
    expect(b.itens[1].valorFmt).toBe('R$ 5,1945');
  });

  it('monta variação com direção e texto; null fica sem variação', () => {
    const b = montarBoletim([
      linha('dolar', 5, 'R$', 0.4),
      linha('euro', 6, 'R$', -1.54),
      linha('ouro', 21000, 'R$', null),
    ]);
    expect(b.itens[0].variacao).toEqual({ texto: '0,4%', direcao: 'alta' });
    expect(b.itens[1].variacao).toEqual({ texto: '1,54%', direcao: 'baixa' });
    expect(b.itens[2].variacao).toBeUndefined();
  });

  it('variação 0 conta como alta (mesma regra do painel)', () => {
    const b = montarBoletim([linha('dolar', 5, 'R$', 0)]);
    expect(b.itens[0].variacao).toEqual({ texto: '0%', direcao: 'alta' });
  });

  it('legenda regional só nas commodities', () => {
    const b = montarBoletim([linha('boi', 326, 'R$/@', null), linha('dolar', 5, 'R$', null)]);
    expect(b.itens[0].legenda).toBe('média MT/PA/TO/GO · CONAB');
    expect(b.itens[1].legenda).toBeUndefined();
  });

  it('data por extenso em pt-BR no fuso do Araguaia', () => {
    const b = montarBoletim([], new Date('2026-07-03T14:00:00Z'));
    expect(b.dataExtenso).toBe('sexta-feira, 3 de julho de 2026');
  });

  it('lista vazia devolve itens vazios sem quebrar', () => {
    const b = montarBoletim([]);
    expect(b.itens).toEqual([]);
    expect(b.dataExtenso.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/boletim.test.ts`
Expected: FAIL — `Cannot find module '@/lib/boletim'`.

- [ ] **Step 3: Write the implementation**

Criar `lib/boletim.ts`:

```ts
import { TITULOS, ORDEM_PAINEL, LEGENDAS } from '@/lib/tipos-ui';

// Linha crua vinda de `cotacoes` (tipos já convertidos pelo chamador).
export type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null };

export type ItemBoletim = {
  titulo: string;
  valorFmt: string; // ex.: "R$/@ 326,96"
  variacao?: { texto: string; direcao: 'alta' | 'baixa' };
  legenda?: string;
};

export type Boletim = { dataExtenso: string; itens: ItemBoletim[] };

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
// Araguaia fica no fuso -03:00 sem horário de verão; fixar o fuso torna a data
// determinística no serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

export function montarBoletim(linhas: LinhaCotacao[], agora: Date = new Date()): Boletim {
  const itens = linhas
    .slice()
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const item: ItemBoletim = {
        titulo: TITULOS[l.tipo] ?? l.tipo,
        valorFmt: `${l.unidade} ${fmtValor.format(l.valor)}`,
      };
      if (l.variacao_pct !== null) {
        item.variacao = {
          texto: `${Math.abs(l.variacao_pct).toLocaleString('pt-BR')}%`,
          direcao: l.variacao_pct >= 0 ? 'alta' : 'baixa',
        };
      }
      const legenda = LEGENDAS[l.tipo];
      if (legenda) item.legenda = legenda;
      return item;
    });
  return { dataExtenso: fmtDataExtenso.format(agora), itens };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/boletim.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — Expected: todos passam (79 existentes + 7 novos).

```bash
git add lib/boletim.ts tests/boletim.test.ts
git commit -m "feat: view-model do boletim diario"
```

---

### Task 2: Rota `/api/boletim` (ImageResponse)

**Files:**
- Create: `app/api/boletim/route.tsx`
- Test: `tests/api/boletim.test.ts`

**Interfaces:**
- Consumes: `montarBoletim`, `Boletim` de `@/lib/boletim` (Task 1); `createPublicClient` de `@/lib/supabase/public` (existente); `ImageResponse` de `next/og`.
- Produces: `GET /api/boletim` → PNG 1080×1080 (200), ou 500 se o banco falhar. A Task 3 só referencia a URL.

- [ ] **Step 1: Write the failing tests**

Criar `tests/api/boletim.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ImageResponse real depende de WASM (Satori/resvg) — mock devolve um Response
// com os headers passados; o PNG de verdade é verificado ponta a ponta na Task 4.
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(_el: unknown, opts?: { headers?: Record<string, string> }) {
      return new Response('png-simulado', {
        status: 200,
        headers: { 'content-type': 'image/png', ...(opts?.headers ?? {}) },
      });
    }
  },
}));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn() }));

import { GET } from '@/app/api/boletim/route';
import { createPublicClient } from '@/lib/supabase/public';

const mockClient = (retorno: { data: unknown; error: unknown }) => {
  (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ select: async () => retorno }),
  });
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/boletim', () => {
  it('200 com content-type de imagem quando há cotações', async () => {
    mockClient({
      data: [{ tipo: 'boi', valor: 326.96, unidade: 'R$/@', variacao_pct: -1.54 }],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\//);
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('200 mesmo com o banco vazio (card de estado vazio)', async () => {
    mockClient({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('500 quando o Supabase falha', async () => {
    mockClient({ data: null, error: { message: 'boom' } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/boletim.test.ts`
Expected: FAIL — módulo `@/app/api/boletim/route` inexistente.

- [ ] **Step 3: Write the implementation**

Criar `app/api/boletim/route.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { montarBoletim, type Boletim } from '@/lib/boletim';

export const dynamic = 'force-dynamic';

const ALTA = '#059669';
const BAIXA = '#dc2626';

// Card 1080×1080 no subconjunto flexbox do Satori (estilos inline; todo div
// com múltiplos filhos-elemento precisa de display flex explícito).
function CardBoletim({ boletim }: { boletim: Boletim }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fffdf7',
        padding: 64,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <svg width="88" height="88" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="7" fill="#15803d" />
          <line x1="16" y1="25.5" x2="16" y2="13" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 17.5c-.7-3.6-3.5-5.6-7.2-5.6-.4 3.9 2.5 6.8 7.2 6.8z" fill="#bbf7d0" />
          <path d="M16 14.2c.7-3.6 3.5-5.6 7.2-5.6.4 3.9-2.5 6.8-7.2 6.8z" fill="#ffffff" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 52, color: '#14532d' }}>Praça Araguaia</div>
          <div style={{ fontSize: 27, color: '#525252' }}>{boletim.dataExtenso}</div>
        </div>
      </div>

      {boletim.itens.length === 0 ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#525252' }}>
          Ainda sem cotações hoje
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 20 }}>
          {boletim.itens.map((item) => (
            <div
              key={item.titulo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #e5e5e5',
                paddingBottom: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 36, color: '#171717' }}>{item.titulo}</div>
                {item.legenda && <div style={{ fontSize: 21, color: '#737373' }}>{item.legenda}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ fontSize: 42, color: '#171717' }}>{item.valorFmt}</div>
                {item.variacao && (
                  <div style={{ display: 'flex', fontSize: 29, color: item.variacao.direcao === 'alta' ? ALTA : BAIXA }}>
                    {item.variacao.direcao === 'alta' ? '▲' : '▼'} {item.variacao.texto}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, color: '#737373' }}>
        <div style={{ display: 'flex' }}>fontes: CONAB · BCB · BCE</div>
        <div style={{ display: 'flex' }}>agroapp-bay.vercel.app</div>
      </div>
    </div>
  );
}

export async function GET() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('cotacoes').select('tipo, valor, unidade, variacao_pct');
  if (error) {
    return new Response('Erro ao carregar cotações', { status: 500 });
  }

  const boletim = montarBoletim(
    (data ?? []).map((c) => ({
      tipo: c.tipo,
      valor: Number(c.valor),
      unidade: c.unidade,
      variacao_pct: c.variacao_pct === null ? null : Number(c.variacao_pct),
    })),
  );

  return new ImageResponse(<CardBoletim boletim={boletim} />, {
    width: 1080,
    height: 1080,
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/boletim.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test && npm run build && npm run lint` — Expected: tudo limpo (o build compila o JSX do Satori de verdade — sem mock).

```bash
git add app/api/boletim/route.tsx tests/api/boletim.test.ts
git commit -m "feat: rota /api/boletim gera o card PNG do dia"
```

---

### Task 3: Página `/boletim` + link no painel

**Files:**
- Create: `app/boletim/page.tsx`
- Modify: `app/page.tsx` (link "Boletim do dia →" após o parágrafo de subtítulo)

**Interfaces:**
- Consumes: a URL `/api/boletim` (Task 2). Nada de novo exportado.
- Produces: páginas finais. Sem teste unitário (páginas não são testadas no projeto) — verificação por `npm run build` + Task 4.

- [ ] **Step 1: Criar `app/boletim/page.tsx`**

```tsx
import Link from 'next/link';

export const metadata = { title: 'Boletim do dia — Praça Araguaia' };

export default function Boletim() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">Boletim do dia</h1>
      <p className="mt-1 text-sm text-neutral-500">Baixe a imagem e compartilhe no Instagram ou WhatsApp.</p>

      {/* Imagem dinâmica gerada pela rota; next/image não otimiza rota própria. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/boletim"
        alt="Boletim do dia com as cotações da Praça Araguaia"
        className="mt-6 w-full max-w-xl rounded-2xl border border-neutral-200 shadow-sm"
      />

      <a
        href="/api/boletim"
        download="boletim-praca-araguaia.png"
        className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        Baixar imagem
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Adicionar o link no painel**

Em `app/page.tsx`, logo após o `<p>` do subtítulo ("Cotações de referência diárias para o produtor."), adicionar:

```tsx
      <Link href="/boletim" className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
        Boletim do dia →
      </Link>
```

(`Link` já está importado em `app/page.tsx`.)

- [ ] **Step 3: Verify — suite, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde; o build lista as rotas `/boletim` e `/api/boletim`.

- [ ] **Step 4: Commit**

```bash
git add app/boletim/page.tsx app/page.tsx
git commit -m "feat: pagina /boletim com download e link no painel"
```

---

### Task 4: Verificação ponta a ponta + deploy

**Files:**
- Modify: `ESTADO-DO-PROJETO.md` (fatia 5 em "O que já está pronto")

**Interfaces:**
- Consumes: tudo das Tasks 1–3.
- Produces: boletim no ar em produção.

- [ ] **Step 1: PNG real no dev server**

Subir `npm run dev` em background e validar o PNG de verdade (PowerShell):

```powershell
curl.exe -s --retry 20 --retry-connrefused --retry-delay 2 http://localhost:3000/ | Out-Null
curl.exe -s -o boletim-teste.png http://localhost:3000/api/boletim
$b = [System.IO.File]::ReadAllBytes('boletim-teste.png')
"Assinatura PNG: $(($b[0..7] -join ',') -eq '137,80,78,71,13,10,26,10')"
"Tamanho: $($b.Length) bytes (esperado > 20000)"
Remove-Item boletim-teste.png -Confirm:$false
```

Expected: assinatura PNG `True` e tamanho > 20 KB. Abrir http://localhost:3000/boletim no navegador (ou conferir o HTML via curl) e checar a imagem + botão. Encerrar o dev server ao final.

- [ ] **Step 2: Atualizar `ESTADO-DO-PROJETO.md`**

Adicionar em "O que já está pronto":

```markdown
### Fatia 5 — Boletim diário em card
- `GET /api/boletim` (pública) gera PNG 1080×1080 via `next/og` (Satori) com as 6 cotações, marca Praça Araguaia, data por extenso e rodapé de fontes; cache de 1h.
- `/boletim` mostra o card com botão "Baixar imagem"; painel ganhou o link "Boletim do dia →".
- View-model puro em `lib/boletim.ts` (ordem do painel, formatação pt-BR, variação ▲/▼, fuso America/Araguaina).
```

Atualizar a contagem de testes no "Estado atual" e remover "Boletim diário em card" da lista "O que falta".

```bash
git add ESTADO-DO-PROJETO.md
git commit -m "docs: estado do projeto com a fatia 5 (boletim diario)"
```

- [ ] **Step 3: Deploy (REQUER APROVAÇÃO DO USUÁRIO)**

Pedir autorização ao usuário e então:

```bash
git push origin master
```

- [ ] **Step 4: Verificação em produção**

```powershell
curl.exe -s -o boletim-prod.png https://agroapp-bay.vercel.app/api/boletim
$b = [System.IO.File]::ReadAllBytes('boletim-prod.png')
"Assinatura PNG: $(($b[0..7] -join ',') -eq '137,80,78,71,13,10,26,10')"; "Tamanho: $($b.Length)"
Remove-Item boletim-prod.png -Confirm:$false
```

Expected: PNG válido; https://agroapp-bay.vercel.app/boletim mostra o card com o botão de download.
