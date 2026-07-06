# Alertas de movimento forte via Telegram (Fatia 13C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cron diário que, quando uma cotação se move ≥ ±3% num novo ponto de preço, envia um digest de alerta a todos os inscritos no Telegram.

**Architecture:** Terceiro cron `GET /api/alertas` (12:25 UTC) lê o snapshot de `cotacoes`, filtra os que cruzaram ±3% (`detectarMovers`, puro), remove os já avisados via tabela de dedup `alertas_enviados`, e — se sobrar algo novo — faz broadcast de um digest por `sendMessage`. Reaproveita o orquestrador de broadcast (extraído do boletim) e o tratamento de 403.

**Tech Stack:** Next.js 15 (App Router, route handlers), TypeScript, Supabase (service role), Vitest, Vercel Cron.

## Global Constraints

- **Zero dependências novas.**
- **Comunicação/UI em português brasileiro.**
- Fuso canônico de data: **America/Araguaina** via `Intl` (determinístico no serverless UTC e nos testes).
- Domínio hardcoded do site: `agroapp-bay.vercel.app` (mesmo do boletim).
- Rotas de cron autenticam por `authorization === 'Bearer ' + process.env.CRON_SECRET` → senão **401**.
- Tabelas com dado sensível têm **RLS ligada sem policy pública** (só service role).
- Limite de alerta: **±3%** para as 6 cotações (um único limite).
- Padrão de teste: `vitest run`; mocks de I/O via `vi.mock`; fetch injetável nas libs.
- Módulos "puros" (`lib/telegram-*.ts` de lógica) **não fazem I/O** — efeitos são injetados.

---

### Task 1: Extrair o orquestrador de broadcast (`enviarEmMassa`)

Refactor sem mudança de comportamento: `enviarBoletim` (hoje em `lib/telegram-boletim.ts`) é genérico; renomeia para `enviarEmMassa` num módulo compartilhado que o boletim e os alertas usam. Os 228 testes atuais devem continuar verdes.

**Files:**
- Create: `lib/telegram-broadcast.ts`
- Create: `tests/telegram-broadcast.test.ts`
- Modify: `lib/telegram-boletim.ts` (remover `ResumoEnvio` + `enviarBoletim`)
- Modify: `app/api/enviar-boletim/route.ts` (importar `enviarEmMassa`)
- Modify: `tests/telegram-boletim.test.ts` (remover o bloco `enviarBoletim`)

**Interfaces:**
- Consumes: `ResultadoEnvio` de `@/lib/telegram`.
- Produces:
  - `type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number }`
  - `enviarEmMassa(args: { chatIds: number[]; enviar: (chatId: number) => Promise<ResultadoEnvio> }): Promise<ResumoEnvio>`

- [ ] **Step 1: Criar `lib/telegram-broadcast.ts`**

```ts
import type { ResultadoEnvio } from '@/lib/telegram';

export type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number };

// Orquestrador puro de broadcast: percorre os chatIds e acumula o resultado.
// O efeito de rede entra por `enviar` (injetado), então é testável sem I/O.
export async function enviarEmMassa(args: {
  chatIds: number[];
  enviar: (chatId: number) => Promise<ResultadoEnvio>;
}): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviados: 0, bloqueados: [], falhas: 0 };
  for (const chatId of args.chatIds) {
    const r = await args.enviar(chatId);
    if (r.ok) resumo.enviados++;
    else if (r.bloqueado) resumo.bloqueados.push(chatId);
    else resumo.falhas++;
  }
  return resumo;
}
```

- [ ] **Step 2: Criar `tests/telegram-broadcast.test.ts` (mover os casos do orquestrador)**

```ts
import { describe, it, expect } from 'vitest';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
import type { ResultadoEnvio } from '@/lib/telegram';

describe('enviarEmMassa', () => {
  it('acumula enviados, coleta bloqueados (403) e conta falhas', async () => {
    const enviar = async (chatId: number): Promise<ResultadoEnvio> => {
      if (chatId === 2) return { ok: false, bloqueado: true };
      if (chatId === 4) return { ok: false, bloqueado: false };
      return { ok: true };
    };
    const resumo = await enviarEmMassa({ chatIds: [1, 2, 3, 4], enviar });
    expect(resumo).toEqual({ enviados: 2, bloqueados: [2], falhas: 1 });
  });

  it('lista vazia devolve tudo zerado', async () => {
    const resumo = await enviarEmMassa({ chatIds: [], enviar: async () => ({ ok: true }) });
    expect(resumo).toEqual({ enviados: 0, bloqueados: [], falhas: 0 });
  });

  it('chama enviar uma vez por chatId', async () => {
    const vistos: number[] = [];
    await enviarEmMassa({
      chatIds: [10, 20, 30],
      enviar: async (id) => {
        vistos.push(id);
        return { ok: true };
      },
    });
    expect(vistos).toEqual([10, 20, 30]);
  });
});
```

- [ ] **Step 3: Editar `lib/telegram-boletim.ts` — remover o orquestrador**

Remover a linha `import type { ResultadoEnvio } from '@/lib/telegram';`, o `export type ResumoEnvio = ...` e toda a função `export async function enviarBoletim(...)`. O arquivo final deve conter **apenas**:

```ts
const SITE = 'https://agroapp-bay.vercel.app';

// Mesmo fuso/formato do boletim PNG (lib/boletim.ts) — data determinística no
// serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
// YYYY-MM-DD no fuso local via 'en-CA' (formato ISO por padrão).
const fmtDataIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });

export function legendaBoletim(agora: Date): string {
  return (
    `☀️ Bom dia! Cotações da Praça Araguaia — ${fmtDataExtenso.format(agora)}. ` +
    `Veja o painel completo em agroapp-bay.vercel.app`
  );
}

export function urlFotoBoletim(agora: Date): string {
  // ?d=<data local> é cache-buster: garante o boletim fresco do dia (CDN 1h).
  return `${SITE}/api/boletim?d=${fmtDataIso.format(agora)}`;
}
```

- [ ] **Step 4: Editar `app/api/enviar-boletim/route.ts` — apontar pro novo módulo**

Trocar o import:

```ts
import { enviarBoletim, legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';
```

por:

```ts
import { legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
```

E trocar a chamada `await enviarBoletim({` por `await enviarEmMassa({` (o resto da desestruturação `{ enviados, bloqueados, falhas }` e os argumentos ficam iguais).

- [ ] **Step 5: Editar `tests/telegram-boletim.test.ts` — remover o bloco do orquestrador**

Trocar a linha de import:

```ts
import { legendaBoletim, urlFotoBoletim, enviarBoletim } from '@/lib/telegram-boletim';
import type { ResultadoEnvio } from '@/lib/telegram';
```

por:

```ts
import { legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';
```

E **apagar todo** o `describe('enviarBoletim', () => { ... })`. Manter os `describe('legendaBoletim'...)` e `describe('urlFotoBoletim'...)`.

- [ ] **Step 6: Rodar os testes afetados**

Run: `npx vitest run tests/telegram-broadcast.test.ts tests/telegram-boletim.test.ts tests/api/enviar-boletim.test.ts`
Expected: PASS (3 arquivos, todos verdes).

- [ ] **Step 7: Commit**

```bash
git add lib/telegram-broadcast.ts tests/telegram-broadcast.test.ts lib/telegram-boletim.ts app/api/enviar-boletim/route.ts tests/telegram-boletim.test.ts
git commit -m "refactor: extrai enviarEmMassa (broadcast) do boletim p/ modulo compartilhado"
```

---

### Task 2: `enviarTexto` — envio de texto com detecção de bloqueio

**Files:**
- Modify: `lib/telegram.ts`
- Modify: `tests/telegram.test.ts`

**Interfaces:**
- Consumes: `ResultadoEnvio` (já exportado de `@/lib/telegram`).
- Produces: `enviarTexto(token: string, chatId: number, texto: string, fetchImpl?: typeof fetch): Promise<ResultadoEnvio>`

- [ ] **Step 1: Escrever os testes de `enviarTexto`**

No `tests/telegram.test.ts`, trocar a linha de import:

```ts
import { interpretarUpdate, enviarMensagem, enviarFoto } from '@/lib/telegram';
```

por:

```ts
import { interpretarUpdate, enviarMensagem, enviarFoto, enviarTexto } from '@/lib/telegram';
```

E adicionar, ao fim do arquivo:

```ts
describe('enviarTexto', () => {
  it('faz POST em sendMessage com chat_id e text; ok em 200', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const r = await enviarTexto('TOKEN123', 42, 'alô', fetchMock);
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 42, text: 'alô' });
  });

  it('403 (bot bloqueado) vira bloqueado:true', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    expect(await enviarTexto('T', 42, 'x', fetchMock)).toEqual({ ok: false, bloqueado: true });
  });

  it('outro erro vira bloqueado:false', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    expect(await enviarTexto('T', 42, 'x', fetchMock)).toEqual({ ok: false, bloqueado: false });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/telegram.test.ts`
Expected: FAIL (`enviarTexto` não exportado).

- [ ] **Step 3: Implementar `enviarTexto` e delegar `enviarMensagem` nele**

Em `lib/telegram.ts`, substituir a função `enviarMensagem` atual por:

```ts
// Envia uma foto/texto... (enviarFoto já existe abaixo)
export async function enviarTexto(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, bloqueado: true };
  console.error('Telegram sendMessage falhou', res.status);
  return { ok: false, bloqueado: false };
}

// Compat: o webhook não precisa do status de bloqueio. Delega em enviarTexto.
export async function enviarMensagem(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await enviarTexto(token, chatId, texto, fetchImpl);
}
```

> Nota: `ResultadoEnvio` já está declarado em `lib/telegram.ts` (Fatia 13B). Se `enviarTexto` for colocado **acima** da declaração de `ResultadoEnvio`/`enviarFoto`, mover para depois dela, ou manter tudo junto no bloco de envio. Não duplicar o tipo.

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/telegram.test.ts`
Expected: PASS (13 testes: interpretarUpdate + enviarMensagem + enviarFoto + enviarTexto).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts tests/telegram.test.ts
git commit -m "feat: enviarTexto com deteccao de 403; enviarMensagem delega nele"
```

---

### Task 3: `lib/telegram-alertas.ts` — detecção e mensagem (puro)

**Files:**
- Create: `lib/telegram-alertas.ts`
- Create: `tests/telegram-alertas.test.ts`

**Interfaces:**
- Consumes: `TITULOS`, `ORDEM_PAINEL` de `@/lib/tipos-ui`.
- Produces:
  - `const LIMITE_ALERTA_PCT = 3`
  - `type Mover = { tipo: string; variacaoPct: number; valor: number; unidade: string; dataReferencia: string }`
  - `type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string }`
  - `detectarMovers(linhas: LinhaCotacao[], limite?: number): Mover[]`
  - `montarMensagemAlerta(movers: Mover[], agora: Date): string`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/telegram-alertas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectarMovers, montarMensagemAlerta, type LinhaCotacao } from '@/lib/telegram-alertas';

const linhas: LinhaCotacao[] = [
  { tipo: 'boi', valor: 340.1, unidade: 'R$/@', variacao_pct: 4.2, data_referencia: '2026-07-06' },
  { tipo: 'dolar', valor: 5.1, unidade: 'R$', variacao_pct: 0.5, data_referencia: '2026-07-06' },
  { tipo: 'soja', valor: 128.4, unidade: 'R$/sc', variacao_pct: -3.5, data_referencia: '2026-07-06' },
  { tipo: 'milho', valor: 60, unidade: 'R$/sc', variacao_pct: null, data_referencia: '2026-07-06' },
  { tipo: 'euro', valor: 6, unidade: 'R$', variacao_pct: 3, data_referencia: '2026-07-06' },
];

describe('detectarMovers', () => {
  it('mantém só |variação| ≥ 3, na ordem do painel', () => {
    // boi(4.2) soja(-3.5) euro(3) entram; dolar(0.5) e milho(null) saem.
    // ORDEM_PAINEL = boi, soja, milho, dolar, euro, ouro → boi, soja, euro.
    expect(detectarMovers(linhas).map((m) => m.tipo)).toEqual(['boi', 'soja', 'euro']);
  });

  it('inclui o limite exato (3) e respeita limite custom', () => {
    expect(detectarMovers(linhas, 5).map((m) => m.tipo)).toEqual([]);
  });

  it('normaliza os campos do mover', () => {
    const boi = detectarMovers(linhas)[0];
    expect(boi).toEqual({ tipo: 'boi', variacaoPct: 4.2, valor: 340.1, unidade: 'R$/@', dataReferencia: '2026-07-06' });
  });
});

describe('montarMensagemAlerta', () => {
  it('monta o digest com data, títulos, sinais, setas e link', () => {
    const movers = detectarMovers(linhas);
    const msg = montarMensagemAlerta(movers, new Date('2026-07-06T13:00:00Z'));
    expect(msg).toContain('6 de julho');
    expect(msg).toContain('Boi gordo');
    expect(msg).toContain('+4,2%');
    expect(msg).toContain('▲');
    expect(msg).toContain('Soja');
    expect(msg).toContain('▼');
    expect(msg).toContain('agroapp-bay.vercel.app');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/telegram-alertas.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lib/telegram-alertas.ts`**

```ts
import { TITULOS, ORDEM_PAINEL } from '@/lib/tipos-ui';

export const LIMITE_ALERTA_PCT = 3;

export type LinhaCotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  variacao_pct: number | null;
  data_referencia: string;
};

export type Mover = {
  tipo: string;
  variacaoPct: number;
  valor: number;
  unidade: string;
  dataReferencia: string;
};

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

// Filtra as cotações que cruzaram o limite (±), na ordem do painel.
export function detectarMovers(linhas: LinhaCotacao[], limite: number = LIMITE_ALERTA_PCT): Mover[] {
  return linhas
    .filter((l) => l.variacao_pct !== null && Math.abs(l.variacao_pct) >= limite)
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => ({
      tipo: l.tipo,
      variacaoPct: l.variacao_pct as number,
      valor: l.valor,
      unidade: l.unidade,
      dataReferencia: l.data_referencia,
    }));
}

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Araguaina' });

export function montarMensagemAlerta(movers: Mover[], agora: Date): string {
  const linhas = movers.map((m) => {
    const seta = m.variacaoPct >= 0 ? '▲' : '▼';
    return `${seta} ${TITULOS[m.tipo] ?? m.tipo} ${fmtPct.format(m.variacaoPct)}%  ${m.unidade} ${fmtValor.format(m.valor)}`;
  });
  return (
    `🚨 Praça Araguaia — movimento forte hoje (${fmtDia.format(agora)})\n` +
    linhas.join('\n') +
    `\nPainel completo: agroapp-bay.vercel.app`
  );
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/telegram-alertas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram-alertas.ts tests/telegram-alertas.test.ts
git commit -m "feat: logica pura dos alertas (detectarMovers + montarMensagemAlerta)"
```

---

### Task 4: Rota `/api/alertas` + migração + cron

**Files:**
- Migration (via Supabase MCP `apply_migration`, project ref `eoguwsybosgzfeiqqxjk`)
- Create: `app/api/alertas/route.ts`
- Create: `tests/api/alertas.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `createServerClient` (`@/lib/supabase/server`), `enviarTexto` (`@/lib/telegram`), `enviarEmMassa` (`@/lib/telegram-broadcast`), `detectarMovers` + `montarMensagemAlerta` (`@/lib/telegram-alertas`).
- Produces: `GET(req: Request): Promise<Response>` respondendo JSON `{ alertados, enviados, removidos, falhas }`.

- [ ] **Step 1: Aplicar a migração `alertas_enviados` via MCP**

Ferramenta: `mcp__claude_ai_Supabase__apply_migration`
- `project_id`: `eoguwsybosgzfeiqqxjk`
- `name`: `alertas_enviados`
- `query`:

```sql
create table if not exists alertas_enviados (
  tipo text not null,
  data_referencia date not null,
  variacao_pct numeric not null,
  enviado_em timestamptz not null default now(),
  primary key (tipo, data_referencia)
);
alter table alertas_enviados enable row level security;
```

Verificar com `mcp__claude_ai_Supabase__list_tables` (schema `public`) que `alertas_enviados` aparece.

- [ ] **Step 2: Escrever os testes da rota (falhando)**

Criar `tests/api/alertas.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarTexto: vi.fn(async () => ({ ok: true })) };
});

import { GET } from '@/app/api/alertas/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarTexto } from '@/lib/telegram';

const SECRET = 'segredo';
const boiMover = { tipo: 'boi', valor: 340.1, unidade: 'R$/@', variacao_pct: 4.2, data_referencia: '2026-07-06' };
const dolarCalmo = { tipo: 'dolar', valor: 5.1, unidade: 'R$', variacao_pct: 0.4, data_referencia: '2026-07-06' };

function mockSupabase({
  cotacoes = [] as unknown[],
  jaEnviados = [] as unknown[],
  chatIds = [] as number[],
  cotErro = null as unknown,
  jaErro = null as unknown,
} = {}) {
  const inFn = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ in: inFn }));
  const insert = vi.fn(async () => ({ error: null }));
  const selCot = vi.fn(async () => ({ data: cotErro ? null : cotacoes, error: cotErro }));
  const selJa = vi.fn(async () => ({ data: jaErro ? null : jaEnviados, error: jaErro }));
  const selSub = vi.fn(async () => ({ data: chatIds.map((chat_id) => ({ chat_id })), error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'cotacoes') return { select: selCot };
    if (table === 'alertas_enviados') return { select: selJa, insert };
    if (table === 'assinantes_telegram') return { select: selSub, delete: del };
    throw new Error('tabela inesperada: ' + table);
  });
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, insert, del, inFn, selCot };
}

const req = (auth: string | null = `Bearer ${SECRET}`) =>
  new Request('http://localhost/api/alertas', { headers: auth !== null ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/alertas', () => {
  it('401 com bearer errado/ausente, sem tocar no banco', async () => {
    const { selCot } = mockSupabase({ cotacoes: [boiMover] });
    expect((await GET(req('Bearer errado'))).status).toBe(401);
    expect((await GET(req(null))).status).toBe(401);
    expect(selCot).not.toHaveBeenCalled();
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('500 quando falta TELEGRAM_BOT_TOKEN', async () => {
    mockSupabase({ cotacoes: [boiMover] });
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await GET(req())).status).toBe(500);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('500 quando a leitura de cotacoes falha', async () => {
    mockSupabase({ cotErro: { message: 'boom' } });
    expect((await GET(req())).status).toBe(500);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('sem movers → 200 zerado, nada enviado', async () => {
    const { insert } = mockSupabase({ cotacoes: [dolarCalmo] });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alertados: 0, enviados: 0, removidos: 0, falhas: 0 });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('caminho feliz: envia por inscrito e grava marcador', async () => {
    const { insert, del } = mockSupabase({ cotacoes: [boiMover, dolarCalmo], chatIds: [10, 20] });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarTexto).toHaveBeenCalledTimes(2);
    const [token, id, texto] = (enviarTexto as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(token).toBe('TOKEN123');
    expect(id).toBe(10);
    expect(texto).toContain('Boi gordo');
    expect(insert).toHaveBeenCalledWith([{ tipo: 'boi', data_referencia: '2026-07-06', variacao_pct: 4.2 }]);
    expect(del).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ alertados: 1, enviados: 2, removidos: 0, falhas: 0 });
  });

  it('dedup: mover já avisado é filtrado → não envia', async () => {
    const { insert } = mockSupabase({
      cotacoes: [boiMover],
      jaEnviados: [{ tipo: 'boi', data_referencia: '2026-07-06' }],
      chatIds: [10],
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ alertados: 0, enviados: 0, removidos: 0, falhas: 0 });
  });

  it('remove bloqueados (403) via .in ao fim', async () => {
    const { del, inFn } = mockSupabase({ cotacoes: [boiMover], chatIds: [1, 2, 3] });
    (enviarTexto as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, bloqueado: true })
      .mockResolvedValueOnce({ ok: true });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(inFn).toHaveBeenCalledWith('chat_id', [2]);
    expect(await res.json()).toEqual({ alertados: 1, enviados: 2, removidos: 1, falhas: 0 });
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `npx vitest run tests/api/alertas.test.ts`
Expected: FAIL (rota não existe).

- [ ] **Step 4: Implementar `app/api/alertas/route.ts`**

```ts
import { createServerClient } from '@/lib/supabase/server';
import { enviarTexto } from '@/lib/telegram';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
import { detectarMovers, montarMensagemAlerta } from '@/lib/telegram-alertas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response('config', { status: 500 });

  const zero = { alertados: 0, enviados: 0, removidos: 0, falhas: 0 };
  const supabase = createServerClient();

  const cots = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');
  if (cots.error) {
    console.error('alertas: leitura de cotacoes falhou', cots.error);
    return new Response('erro', { status: 500 });
  }

  const movers = detectarMovers(cots.data ?? []);
  if (movers.length === 0) return Response.json(zero);

  const ja = await supabase.from('alertas_enviados').select('tipo, data_referencia');
  if (ja.error) {
    console.error('alertas: leitura de alertas_enviados falhou', ja.error);
    return new Response('erro', { status: 500 });
  }
  const jaSet = new Set((ja.data ?? []).map((r) => `${r.tipo}|${r.data_referencia}`));
  const novos = movers.filter((m) => !jaSet.has(`${m.tipo}|${m.dataReferencia}`));
  if (novos.length === 0) return Response.json(zero);

  const texto = montarMensagemAlerta(novos, new Date());

  const subs = await supabase.from('assinantes_telegram').select('chat_id');
  if (subs.error) {
    console.error('alertas: leitura de inscritos falhou', subs.error);
    return new Response('erro', { status: 500 });
  }
  const chatIds = (subs.data ?? []).map((r) => r.chat_id as number);

  const { enviados, bloqueados, falhas } = await enviarEmMassa({
    chatIds,
    enviar: (chatId) => enviarTexto(token, chatId, texto),
  });

  if (bloqueados.length > 0) {
    const del = await supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados);
    if (del.error) console.error('alertas: remoção de bloqueados falhou', del.error);
  }

  const ins = await supabase.from('alertas_enviados').insert(
    novos.map((m) => ({ tipo: m.tipo, data_referencia: m.dataReferencia, variacao_pct: m.variacaoPct })),
  );
  if (ins.error) console.error('alertas: gravação dos marcadores falhou', ins.error);

  return Response.json({ alertados: novos.length, enviados, removidos: bloqueados.length, falhas });
}
```

- [ ] **Step 5: Rodar os testes da rota**

Run: `npx vitest run tests/api/alertas.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Adicionar o cron no `vercel.json`**

Trocar o array `crons` para:

```json
{
  "crons": [
    { "path": "/api/coletar", "schedule": "0 12 * * *" },
    { "path": "/api/enviar-boletim", "schedule": "20 12 * * *" },
    { "path": "/api/alertas", "schedule": "25 12 * * *" }
  ]
}
```

- [ ] **Step 7: Suíte completa + lint + build**

Run: `npx vitest run`
Expected: PASS (todos os arquivos; ~240 testes).

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: build OK; rota `ƒ /api/alertas` listada.

- [ ] **Step 8: Commit**

```bash
git add app/api/alertas/route.ts tests/api/alertas.test.ts vercel.json
git commit -m "feat: cron /api/alertas envia digest de movimento forte via Telegram (fatia 13C)"
```

---

## Verificação pós-deploy (manual, após push)

Depois do deploy do `master`:

1. **Rota no ar + auth:** `GET https://agroapp-bay.vercel.app/api/alertas` sem header e com `Bearer errado` → **401** (ambos).
2. **Disparo autenticado** (segredo do `.env.local`, sem imprimir):
   ```bash
   SECRET=$(grep '^CRON_SECRET=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'\r\n')
   curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $SECRET" \
     "https://agroapp-bay.vercel.app/api/alertas"
   ```
   Esperado: **200** com `{"alertados":N,"enviados":...}`. Em dia sem movimento ≥3%, `alertados:0` (correto — nada a avisar). O alerta real dispara quando um mover novo aparecer; o cron das 12:25 UTC repete sozinho.
3. **Idempotência do dia:** repetir o disparo → se já alertou algo, o segundo chama volta `alertados:0` (dedup gravado em `alertas_enviados`).

## Notas para o executor

- **Ordem das tarefas importa:** Task 1 (refactor) antes das demais, senão `enviarEmMassa` não existe. Task 2 e 3 são independentes entre si, mas ambas antes da Task 4.
- **Não tocar nos testes existentes** além do descrito (remoção do bloco `enviarBoletim` na Task 1 e o import na Task 2).
- Rodar `npx vitest run` (não `vitest watch`) para não travar a sessão.
- Migração é a única ação com efeito externo antes do deploy — aplicar via MCP no projeto `eoguwsybosgzfeiqqxjk` (Supabase `agro_app`, sa-east-1).
