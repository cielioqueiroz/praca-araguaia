# Bot de Telegram — Inscrição + Webhook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um webhook do Telegram que responde a `/start` (inscrever) e `/parar` (sair), guardando os inscritos numa tabela — a fundação do bot.

**Architecture:** Lógica pura em `lib/telegram.ts` (`interpretarUpdate` + `enviarMensagem` + textos); a rota `app/api/telegram/route.ts` verifica o secret, roteia o comando, escreve em `assinantes_telegram` (service role) e responde ao usuário; tabela nova com RLS fechada. Sem dependências (só `fetch` para `api.telegram.org`).

**Tech Stack:** Next 15 App Router, TypeScript strict, Supabase (service role), Vitest.

## Global Constraints

- Zero dependências novas (só `fetch` nativo). Reaproveita `createServerClient` de `@/lib/supabase/server`.
- Env server-only: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- Webhook verifica o header `x-telegram-bot-api-secret-token` contra `TELEGRAM_WEBHOOK_SECRET`; diferente/ausente → **401**. Env do bot ausente → **500**.
- Sempre responder **200** nos casos válidos (corpo inválido, update ignorado, falha de envio/DB) — o Telegram re-tenta em não-200; erros vão para `console.error`.
- `/parar` **apaga** o registro; `/start` faz **upsert idempotente** (`onConflict: 'chat_id', ignoreDuplicates: true`).
- Só o `chat_id` é guardado. Tabela com RLS ligada, sem policy, `revoke all` de anon/authenticated.
- Match do comando: início do texto, case-insensitive (`/start`, `/parar`); qualquer outro texto → `ajuda`; update sem mensagem de texto/`chat.id` → `ignorar`.
- Textos de UI em português brasileiro.

---

### Task 1: Lógica pura do Telegram (`lib/telegram.ts`)

**Files:**
- Create: `lib/telegram.ts`
- Test: `tests/telegram.test.ts`

**Interfaces:**
- Consumes: nada do projeto (só `fetch`).
- Produces (consumido pela Task 2):
  - `type IntencaoTelegram = { tipo: 'start'; chatId: number } | { tipo: 'parar'; chatId: number } | { tipo: 'ajuda'; chatId: number } | { tipo: 'ignorar' }`
  - `interpretarUpdate(update: unknown): IntencaoTelegram`
  - `enviarMensagem(token: string, chatId: number, texto: string, fetchImpl?: typeof fetch): Promise<void>`
  - `TEXTO_BOAS_VINDAS`, `TEXTO_DESPEDIDA`, `TEXTO_AJUDA` (strings)

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/telegram.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { interpretarUpdate, enviarMensagem } from '@/lib/telegram';

const msg = (text: string, id: number = 42) => ({ message: { text, chat: { id } } });

describe('interpretarUpdate', () => {
  it('/start vira start com o chatId', () => {
    expect(interpretarUpdate(msg('/start'))).toEqual({ tipo: 'start', chatId: 42 });
  });

  it('/parar vira parar', () => {
    expect(interpretarUpdate(msg('/parar'))).toEqual({ tipo: 'parar', chatId: 42 });
  });

  it('ignora sufixo do bot e argumentos, case-insensitive', () => {
    expect(interpretarUpdate(msg('/start@PracaBot'))).toEqual({ tipo: 'start', chatId: 42 });
    expect(interpretarUpdate(msg('/START agora'))).toEqual({ tipo: 'start', chatId: 42 });
  });

  it('qualquer outro texto vira ajuda', () => {
    expect(interpretarUpdate(msg('oi'))).toEqual({ tipo: 'ajuda', chatId: 42 });
  });

  it('update sem mensagem de texto vira ignorar', () => {
    expect(interpretarUpdate({})).toEqual({ tipo: 'ignorar' });
    expect(interpretarUpdate({ message: { chat: { id: 42 } } })).toEqual({ tipo: 'ignorar' });
    expect(interpretarUpdate(null)).toEqual({ tipo: 'ignorar' });
  });

  it('mensagem de texto sem chat.id numérico vira ignorar', () => {
    expect(interpretarUpdate({ message: { text: '/start', chat: {} } })).toEqual({ tipo: 'ignorar' });
  });
});

describe('enviarMensagem', () => {
  it('faz POST em sendMessage com chat_id e text', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    await enviarMensagem('TOKEN123', 42, 'olá', fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 42, text: 'olá' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/telegram.test.ts`
Expected: FAIL — `Cannot find module '@/lib/telegram'`.

- [ ] **Step 3: Implementar `lib/telegram.ts`**

```ts
export type IntencaoTelegram =
  | { tipo: 'start'; chatId: number }
  | { tipo: 'parar'; chatId: number }
  | { tipo: 'ajuda'; chatId: number }
  | { tipo: 'ignorar' };

export const TEXTO_BOAS_VINDAS =
  'Pronto! Você vai receber o boletim diário da Praça Araguaia por aqui. ' +
  'Para sair quando quiser, é só mandar /parar.';
export const TEXTO_DESPEDIDA =
  'Você saiu dos avisos da Praça Araguaia. Quando quiser voltar, mande /start.';
export const TEXTO_AJUDA =
  'Praça Araguaia no Telegram:\n/start — receber o boletim diário\n/parar — sair dos avisos';

// Lê um update do Telegram e devolve a intenção. Puro: não faz I/O.
export function interpretarUpdate(update: unknown): IntencaoTelegram {
  const msg = (update as { message?: { text?: unknown; chat?: { id?: unknown } } } | null)?.message;
  const texto = msg?.text;
  const chatId = msg?.chat?.id;
  if (typeof texto !== 'string' || typeof chatId !== 'number') return { tipo: 'ignorar' };
  const comando = texto.trim().toLowerCase();
  if (comando.startsWith('/start')) return { tipo: 'start', chatId };
  if (comando.startsWith('/parar')) return { tipo: 'parar', chatId };
  return { tipo: 'ajuda', chatId };
}

// Envia uma mensagem de texto via Bot API. fetchImpl injetável para teste.
export async function enviarMensagem(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  if (!res.ok) console.error('Telegram sendMessage falhou', res.status);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/telegram.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts tests/telegram.test.ts
git commit -m "feat: logica pura do bot de telegram (interpretarUpdate + enviarMensagem)"
```

---

### Task 2: Migração + webhook (`app/api/telegram/route.ts`)

**Files:**
- Create: `supabase/migrations/0004_assinantes_telegram.sql`
- Create: `app/api/telegram/route.ts`
- Modify: `.env.local.example` (acrescentar `TELEGRAM_BOT_TOKEN=` e `TELEGRAM_WEBHOOK_SECRET=`)
- Test: `tests/api/telegram.test.ts`

**Interfaces:**
- Consumes (Task 1): `interpretarUpdate`, `enviarMensagem`, `TEXTO_BOAS_VINDAS`, `TEXTO_DESPEDIDA`, `TEXTO_AJUDA`; `createServerClient` de `@/lib/supabase/server`.
- Produces: `POST /api/telegram` (webhook).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `tests/api/telegram.test.ts` (mock encadeável no padrão de `tests/api/reportar.test.ts`):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/telegram', async (orig) => {
  const real = await orig<typeof import('@/lib/telegram')>();
  return { ...real, enviarMensagem: vi.fn(async () => {}) };
});

import { POST } from '@/app/api/telegram/route';
import { createServerClient } from '@/lib/supabase/server';
import { enviarMensagem } from '@/lib/telegram';

const SECRET = 'seg-red-o';

function mockSupabase() {
  const upsert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(async () => ({ error: null }));
  const del = vi.fn(() => ({ eq }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ upsert, delete: del })),
  });
  return { upsert, del, eq };
}

const req = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/api/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret !== null ? { 'x-telegram-bot-api-secret-token': secret } : {}),
    },
    body: JSON.stringify(body),
  });

const msg = (text: string, id = 42) => ({ message: { text, chat: { id } } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN123');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/telegram', () => {
  it('401 quando o secret do header está errado/ausente, sem tocar no banco', async () => {
    const { upsert } = mockSupabase();
    expect((await POST(req(msg('/start'), 'errado'))).status).toBe(401);
    expect((await POST(req(msg('/start'), null))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('500 quando falta env do bot', async () => {
    mockSupabase();
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await POST(req(msg('/start')))).status).toBe(500);
  });

  it('/start faz upsert do chat_id e manda boas-vindas', async () => {
    const { upsert } = mockSupabase();
    const res = await POST(req(msg('/start')));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ chat_id: 42 }, { onConflict: 'chat_id', ignoreDuplicates: true });
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('boletim'), undefined);
  });

  it('/parar apaga o chat_id e manda despedida', async () => {
    const { del, eq } = mockSupabase();
    const res = await POST(req(msg('/parar')));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('chat_id', 42);
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('saiu'), undefined);
  });

  it('texto qualquer manda ajuda, sem tocar no banco', async () => {
    const { upsert, del } = mockSupabase();
    const res = await POST(req(msg('bom dia')));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(enviarMensagem).toHaveBeenCalledWith('TOKEN123', 42, expect.stringContaining('/start'), undefined);
  });

  it('update sem texto responde 200 sem ação', async () => {
    const { upsert } = mockSupabase();
    const res = await POST(req({ update_id: 1 }));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(enviarMensagem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/telegram.test.ts`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar `app/api/telegram/route.ts`**

```ts
import { createServerClient } from '@/lib/supabase/server';
import {
  interpretarUpdate,
  enviarMensagem,
  TEXTO_BOAS_VINDAS,
  TEXTO_DESPEDIDA,
  TEXTO_AJUDA,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return new Response('config', { status: 500 });
  }
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response('ok', { status: 200 }); // corpo inválido: não gerar retry
  }

  const intencao = interpretarUpdate(update);
  try {
    const supabase = createServerClient();
    if (intencao.tipo === 'start') {
      await supabase
        .from('assinantes_telegram')
        .upsert({ chat_id: intencao.chatId }, { onConflict: 'chat_id', ignoreDuplicates: true });
      await enviarMensagem(token, intencao.chatId, TEXTO_BOAS_VINDAS);
    } else if (intencao.tipo === 'parar') {
      await supabase.from('assinantes_telegram').delete().eq('chat_id', intencao.chatId);
      await enviarMensagem(token, intencao.chatId, TEXTO_DESPEDIDA);
    } else if (intencao.tipo === 'ajuda') {
      await enviarMensagem(token, intencao.chatId, TEXTO_AJUDA);
    }
  } catch (e) {
    console.error('webhook telegram falhou', e); // 200 mesmo assim, para o Telegram não re-tentar em loop
  }

  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/telegram.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar a migração**

Criar `supabase/migrations/0004_assinantes_telegram.sql`:

```sql
-- Inscritos do bot de Telegram: só o chat_id, escrito pelo webhook (service role).
create table assinantes_telegram (
  chat_id bigint primary key,
  criado_em timestamptz not null default now()
);

alter table assinantes_telegram enable row level security;
-- Sem policy: nega tudo por padrão. Só o service role (webhook) acessa.
revoke all on assinantes_telegram from anon, authenticated;
```

- [ ] **Step 6: Acrescentar as env de exemplo**

Em `.env.local.example`, acrescentar ao final:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

- [ ] **Step 7: Suíte completa, build e lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: toda a suíte PASS (190 + os novos), build e lint limpos. A rota `/api/telegram` aparece como dinâmica.

- [ ] **Step 8: Commit**

```bash
git add app/api/telegram/route.ts supabase/migrations/0004_assinantes_telegram.sql .env.local.example tests/api/telegram.test.ts
git commit -m "feat: webhook do telegram (/start inscreve, /parar sai) + migracao"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch (opus).
2. **Pré-deploy (usuário + controlador):** criar o bot no @BotFather → `TELEGRAM_BOT_TOKEN`; gerar `TELEGRAM_WEBHOOK_SECRET`; cadastrar as duas env no projeto Vercel (Production); **aplicar a migração `0004` via MCP antes do deploy**.
3. Push com aprovação → deploy.
4. Registrar o webhook: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://agroapp-bay.vercel.app/api/telegram" -d "secret_token=<SECRET>"`.
5. E2E prod: mandar `/start` ao bot → boas-vindas + linha em `assinantes_telegram`; `/parar` → despedida + linha removida; limpar o `chat_id` de teste.
6. Atualizar `ESTADO-DO-PROJETO.md` (fatia 13A) e memória.

## Self-Review (feito)

- **Cobertura da spec:** tabela+RLS (Task 2/migração); `interpretarUpdate`+`enviarMensagem`+textos (Task 1); webhook com secret/env/roteamento/200-sempre (Task 2); testes de lógica e de rota cobrindo 401/500/start/parar/ajuda/ignorar. ✔
- **Placeholders:** nenhum — todo passo traz o código real. ✔
- **Consistência de tipos:** `IntencaoTelegram`, `interpretarUpdate`, `enviarMensagem` e os textos idênticos entre Task 1 (definição) e Task 2 (consumo); `upsert(..., { onConflict: 'chat_id', ignoreDuplicates: true })` e `delete().eq('chat_id', …)` batendo entre rota e teste. ✔

Nota: o teste da rota afirma `enviarMensagem(..., undefined)` porque a rota chama `enviarMensagem(token, chatId, texto)` sem o 4º argumento (o mock registra o 4º como `undefined`).
