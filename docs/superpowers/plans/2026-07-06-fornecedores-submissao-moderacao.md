# Fornecedores com submissão + moderação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fornecedores se cadastram por um formulário público; o dono aprova/rejeita/remove em `/moderar`; só o aprovado aparece na vitrine `/fornecedores`.

**Architecture:** Espelha o fluxo dos reportes de preço — tabela `fornecedores` com `status` (pendente/aprovado/removido), RLS deixando o anon ler só aprovado; submissão via `POST /api/fornecedores` (service role, honeypot + limite por IP); moderação numa aba nova do `/moderar` via `POST /api/moderar/fornecedor` (cookie da mesma senha); vitrine lê os aprovados do banco.

**Tech Stack:** Next.js 15 (App Router, route handlers, server/client components), TypeScript, Supabase (service role + anon/RLS), Vitest + Testing Library.

## Global Constraints

- **Zero dependências novas.** Comunicação/UI em **português brasileiro**.
- Honeypot: campo `contato` (não-vazio ⇒ bot). Nunca guardar IP puro — só `ip_hash` sha256.
- WhatsApp válido casa `^\d{12,13}$` (DDI+DDD+número).
- Tabelas com dado sensível: **RLS ligada**; anon só lê `status='aprovado'`; escrita sempre por service role.
- Moderação atrás de `MODERACAO_SENHA` (cookie HMAC, mesma sessão dos reportes).
- Páginas que precisam refletir aprovações na hora são `force-dynamic`.
- Transições: `aprovado`/`rejeitado` só a partir de `pendente`; `removido` só a partir de `aprovado`.
- Testes: `npx vitest run` (nunca watch). Mocks de I/O via `vi.mock`. Módulos puros sem I/O.
- `lib/fornecedores.ts` é importado por componentes client → **não** pode importar `node:crypto` (usar regex UUID local, não a de `moderacao.ts`).

---

### Task 1: Validações puras em `lib/fornecedores.ts`

**Files:**
- Modify: `lib/fornecedores.ts`
- Test: `tests/fornecedores.test.ts` (append)

**Interfaces:**
- Consumes: `CATEGORIAS`, `Fornecedor`, `CategoriaFornecedor` (já em `lib/fornecedores.ts`).
- Produces:
  - `normalizarWhatsapp(texto: string): string`
  - `type ValidacaoFornecedor = { tipo:'honeypot' } | { tipo:'invalido'; erro:string } | { tipo:'valido'; fornecedor: Fornecedor }`
  - `validarFornecedor(body: unknown): ValidacaoFornecedor`
  - `type DecisaoFornecedor = 'aprovado' | 'rejeitado' | 'removido'`
  - `type ValidacaoDecisaoFornecedor = { tipo:'invalido'; erro:string } | { tipo:'valido'; id:string; decisao:DecisaoFornecedor }`
  - `validarDecisaoFornecedor(body: unknown): ValidacaoDecisaoFornecedor`

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao fim de `tests/fornecedores.test.ts`, e trocar a primeira linha de import para incluir os novos nomes:

```ts
import {
  linkWhatsApp,
  agruparPorCategoria,
  CATEGORIAS,
  FORNECEDORES,
  MENSAGEM_PADRAO,
  normalizarWhatsapp,
  validarFornecedor,
  validarDecisaoFornecedor,
  type Fornecedor,
  type CategoriaFornecedor,
} from '@/lib/fornecedores';
```

Blocos novos (append):

```ts
describe('normalizarWhatsapp', () => {
  it('prepende 55 quando vem só DDD+número', () => {
    expect(normalizarWhatsapp('(94) 99999-8888')).toBe('5594999998888');
    expect(normalizarWhatsapp('9499998888')).toBe('559499998888'); // 10 dígitos → +55
  });
  it('mantém quando já tem DDI e tira lixo não-numérico', () => {
    expect(normalizarWhatsapp('55 94 99999-8888')).toBe('5594999998888');
    expect(normalizarWhatsapp('abc')).toBe('');
  });
});

describe('validarFornecedor', () => {
  const valido = {
    nome: 'Casa Agro',
    categoria: 'racao-sal',
    oQueVende: 'ração e sal mineral',
    municipio: 'Redenção',
    whatsapp: '(94) 99999-8888',
    contato: '',
  };

  it('aceita e normaliza (whatsapp com 55, strings trimadas)', () => {
    const r = validarFornecedor(valido);
    expect(r).toEqual({
      tipo: 'valido',
      fornecedor: {
        nome: 'Casa Agro',
        categoria: 'racao-sal',
        oQueVende: 'ração e sal mineral',
        municipio: 'Redenção',
        whatsapp: '5594999998888',
      },
    });
  });

  it('honeypot preenchido → honeypot', () => {
    expect(validarFornecedor({ ...valido, contato: 'sou bot' })).toEqual({ tipo: 'honeypot' });
  });

  it('rejeita nome curto, categoria fora da lista, oQueVende vazio, município curto e whatsapp inválido', () => {
    expect(validarFornecedor({ ...valido, nome: 'A' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, categoria: 'inexistente' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, oQueVende: ' ' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, municipio: 'X' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, whatsapp: '123' }).tipo).toBe('invalido');
  });

  it('corpo não-objeto → inválido', () => {
    expect(validarFornecedor(null).tipo).toBe('invalido');
  });
});

describe('validarDecisaoFornecedor', () => {
  const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  it('aceita aprovado/rejeitado/removido com UUID', () => {
    for (const decisao of ['aprovado', 'rejeitado', 'removido'] as const) {
      expect(validarDecisaoFornecedor({ id: UUID, decisao })).toEqual({ tipo: 'valido', id: UUID, decisao });
    }
  });
  it('rejeita id não-UUID e decisão desconhecida', () => {
    expect(validarDecisaoFornecedor({ id: 'abc', decisao: 'aprovado' }).tipo).toBe('invalido');
    expect(validarDecisaoFornecedor({ id: UUID, decisao: 'sumir' }).tipo).toBe('invalido');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/fornecedores.test.ts`
Expected: FAIL (`normalizarWhatsapp`/`validarFornecedor`/`validarDecisaoFornecedor` não exportados).

- [ ] **Step 3: Implementar as funções em `lib/fornecedores.ts`**

Adicionar ao fim do arquivo (deixe o `export const FORNECEDORES` como está — sai na Task 5):

```ts
export type ValidacaoFornecedor =
  | { tipo: 'honeypot' }
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; fornecedor: Fornecedor };

// Tira não-dígitos; prepende '55' (DDI Brasil) quando vem só DDD+número (10–11 dígitos).
export function normalizarWhatsapp(texto: string): string {
  const digitos = texto.replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

export function validarFornecedor(body: unknown): ValidacaoFornecedor {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.contato === 'string' && b.contato.trim() !== '') {
    return { tipo: 'honeypot' };
  }
  const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
  if (nome.length < 2 || nome.length > 60) {
    return { tipo: 'invalido', erro: 'Informe o nome do fornecedor.' };
  }
  const categoria = b.categoria;
  if (typeof categoria !== 'string' || !CATEGORIAS.some((c) => c.id === categoria)) {
    return { tipo: 'invalido', erro: 'Escolha uma categoria da lista.' };
  }
  const oQueVende = typeof b.oQueVende === 'string' ? b.oQueVende.trim() : '';
  if (oQueVende.length < 2 || oQueVende.length > 120) {
    return { tipo: 'invalido', erro: 'Descreva o que o fornecedor vende.' };
  }
  const municipio = typeof b.municipio === 'string' ? b.municipio.trim() : '';
  if (municipio.length < 2 || municipio.length > 60) {
    return { tipo: 'invalido', erro: 'Informe o município.' };
  }
  const whatsapp = normalizarWhatsapp(typeof b.whatsapp === 'string' ? b.whatsapp : '');
  if (!/^\d{12,13}$/.test(whatsapp)) {
    return { tipo: 'invalido', erro: 'WhatsApp inválido — use DDD + número.' };
  }
  return {
    tipo: 'valido',
    fornecedor: { nome, categoria: categoria as CategoriaFornecedor, oQueVende, municipio, whatsapp },
  };
}

export type DecisaoFornecedor = 'aprovado' | 'rejeitado' | 'removido';
export type ValidacaoDecisaoFornecedor =
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; id: string; decisao: DecisaoFornecedor };

// UUID local (não importar de moderacao.ts, que puxa node:crypto para o bundle client).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarDecisaoFornecedor(body: unknown): ValidacaoDecisaoFornecedor {
  if (typeof body !== 'object' || body === null) return { tipo: 'invalido', erro: 'Envio inválido.' };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { tipo: 'invalido', erro: 'Fornecedor inválido.' };
  if (b.decisao !== 'aprovado' && b.decisao !== 'rejeitado' && b.decisao !== 'removido') {
    return { tipo: 'invalido', erro: 'Decisão inválida.' };
  }
  return { tipo: 'valido', id: b.id, decisao: b.decisao };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/fornecedores.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fornecedores.ts tests/fornecedores.test.ts
git commit -m "feat: validacoes puras de fornecedor (submissao + decisao de moderacao)"
```

---

### Task 2: Migração + `POST /api/fornecedores` (submissão pública)

**Files:**
- Migration (Supabase MCP `apply_migration`, project ref `eoguwsybosgzfeiqqxjk`)
- Create: `app/api/fornecedores/route.ts`
- Test: `tests/api/fornecedores.test.ts`

**Interfaces:**
- Consumes: `validarFornecedor` (Task 1), `createServerClient` (`@/lib/supabase/server`).
- Produces: `POST(req: Request): Promise<Response>` → 200 `{recebido:true}` / 400 / 429 / 500.

- [ ] **Step 1: Aplicar a migração `fornecedores` via MCP**

Ferramenta `mcp__claude_ai_Supabase__apply_migration`:
- `project_id`: `eoguwsybosgzfeiqqxjk`
- `name`: `fornecedores`
- `query`:

```sql
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  o_que_vende text not null,
  municipio text not null,
  whatsapp text not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','removido')),
  ip_hash text,
  criado_em timestamptz not null default now()
);
alter table fornecedores enable row level security;
create policy "anon le aprovados" on fornecedores
  for select to anon using (status = 'aprovado');
```

Verificar com `mcp__claude_ai_Supabase__list_tables` (schema `public`) que `fornecedores` aparece com `rls_enabled: true`.

- [ ] **Step 2: Escrever os testes (falhando)**

Criar `tests/api/fornecedores.test.ts` (espelha `tests/api/reportar.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/fornecedores/route';
import { createServerClient } from '@/lib/supabase/server';

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
  new Request('http://localhost/api/fornecedores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });

const valido = {
  nome: 'Casa Agro',
  categoria: 'racao-sal',
  oQueVende: 'ração e sal',
  municipio: 'Redenção',
  whatsapp: '(94) 99999-8888',
  contato: '',
};

beforeEach(() => vi.clearAllMocks());

describe('POST /api/fornecedores', () => {
  it('200 grava pendente com o_que_vende, whatsapp normalizado e ip_hash (sem IP puro)', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req(valido));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recebido: true });
    const gravado = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).toMatchObject({
      nome: 'Casa Agro',
      categoria: 'racao-sal',
      o_que_vende: 'ração e sal',
      municipio: 'Redenção',
      whatsapp: '5594999998888',
    });
    expect(String(gravado.ip_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(gravado.ip_hash)).not.toContain('1.2.3.4');
    expect('status' in gravado).toBe(false); // default do banco
  });

  it('400 para envio inválido, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, whatsapp: '123' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('honeypot: 200 de mentira, sem gravar', async () => {
    const { insert } = mockSupabase();
    const res = await POST(req({ ...valido, contato: 'sou bot' }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('429 quando o IP já mandou 3 em 24h', async () => {
    const { insert } = mockSupabase({ count: 3 });
    const res = await POST(req(valido));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it('500 quando o banco falha no insert', async () => {
    mockSupabase({ insertError: { message: 'boom' } });
    expect((await POST(req(valido))).status).toBe(500);
  });

  it('corpo que não é JSON vira 400', async () => {
    mockSupabase();
    const res = await POST(new Request('http://localhost/api/fornecedores', { method: 'POST', body: 'nao-json' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `npx vitest run tests/api/fornecedores.test.ts`
Expected: FAIL (rota não existe).

- [ ] **Step 4: Implementar `app/api/fornecedores/route.ts`**

```ts
import { createHash } from 'node:crypto';
import { createServerClient } from '@/lib/supabase/server';
import { validarFornecedor } from '@/lib/fornecedores';

export const dynamic = 'force-dynamic';

const LIMITE_24H = 3;

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

  const validacao = validarFornecedor(body);
  if (validacao.tipo === 'honeypot') return Response.json({ recebido: true });
  if (validacao.tipo === 'invalido') return Response.json({ erro: validacao.erro }, { status: 400 });

  const supabase = createServerClient();
  const hash = ipHash(req);
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: erroContagem } = await supabase
    .from('fornecedores')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash)
    .gte('criado_em', desde);
  if (erroContagem) return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  if ((count ?? 0) >= LIMITE_24H) {
    return Response.json({ erro: 'Limite diário atingido — tente amanhã.' }, { status: 429 });
  }

  const f = validacao.fornecedor;
  const { error } = await supabase.from('fornecedores').insert({
    nome: f.nome,
    categoria: f.categoria,
    o_que_vende: f.oQueVende,
    municipio: f.municipio,
    whatsapp: f.whatsapp,
    ip_hash: hash,
  });
  if (error) return Response.json({ erro: 'Erro ao registrar. Tente de novo.' }, { status: 500 });
  return Response.json({ recebido: true });
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/api/fornecedores.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
git add app/api/fornecedores/route.ts tests/api/fornecedores.test.ts
git commit -m "feat: POST /api/fornecedores (submissao publica, honeypot, limite 3/IP/24h)"
```

---

### Task 3: `POST /api/moderar/fornecedor` (decisão)

**Files:**
- Create: `app/api/moderar/fornecedor/route.ts`
- Test: `tests/api/moderar-fornecedor.test.ts`

**Interfaces:**
- Consumes: `lerTokenDoCookie`, `verificarToken` (`@/lib/moderacao`), `validarDecisaoFornecedor` (Task 1), `createServerClient`.
- Produces: `POST(req: Request): Promise<Response>` → 200 `{ok:true}` / 401 / 400 / 404 / 500.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/api/moderar-fornecedor.test.ts` (espelha `tests/api/moderar-decidir.test.ts`):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/moderar/fornecedor/route';
import { createServerClient } from '@/lib/supabase/server';
import { criarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function mockSupabase({ linhas = [{ id: UUID }], error = null }: { linhas?: { id: string }[]; error?: unknown } = {}) {
  const select = vi.fn(async () => ({ data: error ? null : linhas, error }));
  const eqStatus = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqStatus }));
  const update = vi.fn(() => ({ eq: eqId }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn(() => ({ update })) });
  return { update, eqId, eqStatus };
}

const req = (body: unknown, cookie?: string) =>
  new Request('http://localhost/api/moderar/fornecedor', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie !== undefined ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const cookieValido = () => `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/fornecedor', () => {
  it('401 sem cookie / token adulterado / sem senha', async () => {
    mockSupabase();
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }))).status).toBe(401);
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, `${COOKIE_MODERACAO}=123.abc`))).status).toBe(401);
    vi.stubEnv('MODERACAO_SENHA', '');
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()))).status).toBe(401);
  });

  it('400 para body inválido, sem tocar no banco', async () => {
    const { update } = mockSupabase();
    expect((await POST(req({ id: 'abc', decisao: 'aprovado' }, cookieValido()))).status).toBe(400);
    expect((await POST(req({ id: UUID, decisao: 'sumir' }, cookieValido()))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('aprovar: update status=aprovado exigindo origem pendente', async () => {
    const { update, eqId, eqStatus } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: 'aprovado' });
    expect(eqId).toHaveBeenCalledWith('id', UUID);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('rejeitar exige origem pendente', async () => {
    const { eqStatus } = mockSupabase();
    await POST(req({ id: UUID, decisao: 'rejeitado' }, cookieValido()));
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('remover exige origem aprovado', async () => {
    const { update, eqStatus } = mockSupabase();
    await POST(req({ id: UUID, decisao: 'removido' }, cookieValido()));
    expect(update).toHaveBeenCalledWith({ status: 'removido' });
    expect(eqStatus).toHaveBeenCalledWith('status', 'aprovado');
  });

  it('404 quando nada foi afetado', async () => {
    mockSupabase({ linhas: [] });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(404);
  });

  it('500 quando o banco falha', async () => {
    mockSupabase({ error: { message: 'boom' } });
    expect((await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()))).status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/api/moderar-fornecedor.test.ts`
Expected: FAIL (rota não existe).

- [ ] **Step 3: Implementar `app/api/moderar/fornecedor/route.ts`**

```ts
import { createServerClient } from '@/lib/supabase/server';
import { lerTokenDoCookie, verificarToken } from '@/lib/moderacao';
import { validarDecisaoFornecedor, type DecisaoFornecedor } from '@/lib/fornecedores';

export const dynamic = 'force-dynamic';

// Aprovar/rejeitar só de pendente; remover só de aprovado.
const ORIGEM: Record<DecisaoFornecedor, 'pendente' | 'aprovado'> = {
  aprovado: 'pendente',
  rejeitado: 'pendente',
  removido: 'aprovado',
};

export async function POST(req: Request) {
  const senha = process.env.MODERACAO_SENHA;
  const token = lerTokenDoCookie(req.headers.get('cookie'));
  if (!senha || !token || !verificarToken(token, Date.now(), senha)) {
    return Response.json({ erro: 'Sessão inválida — entre de novo.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }
  const validacao = validarDecisaoFornecedor(body);
  if (validacao.tipo === 'invalido') return Response.json({ erro: validacao.erro }, { status: 400 });

  // Só a origem permitida muda; as linhas afetadas dizem se algo mudou (sem TOCTOU).
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('fornecedores')
    .update({ status: validacao.decisao })
    .eq('id', validacao.id)
    .eq('status', ORIGEM[validacao.decisao])
    .select('id');
  if (error) return Response.json({ erro: 'Erro ao salvar. Tente de novo.' }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ erro: 'Fornecedor não encontrado ou já resolvido.' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/api/moderar-fornecedor.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/moderar/fornecedor/route.ts tests/api/moderar-fornecedor.test.ts
git commit -m "feat: POST /api/moderar/fornecedor (aprovar/rejeitar/remover com guarda de origem)"
```

---

### Task 4: Formulário público + página `/fornecedores/anunciar`

**Files:**
- Create: `components/FormAnuncioFornecedor.tsx`
- Create: `app/fornecedores/anunciar/page.tsx`
- Test: `tests/components/FormAnuncioFornecedor.test.tsx`

**Interfaces:**
- Consumes: `CATEGORIAS`, `CategoriaFornecedor` (`@/lib/fornecedores`); `POST /api/fornecedores` (Task 2).
- Produces: `<FormAnuncioFornecedor />` (client).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/components/FormAnuncioFornecedor.test.tsx` (espelha `FormReporte.test.tsx`):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormAnuncioFornecedor } from '@/components/FormAnuncioFornecedor';

beforeEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }) as never);
}

function preencher() {
  fireEvent.change(screen.getByLabelText('Nome do fornecedor'), { target: { value: 'Casa Agro' } });
  fireEvent.change(screen.getByLabelText('O que vende'), { target: { value: 'ração e sal' } });
  fireEvent.change(screen.getByLabelText('Município'), { target: { value: 'Redenção' } });
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: '(94) 99999-8888' } });
}

describe('FormAnuncioFornecedor', () => {
  it('renderiza os campos e o botão', () => {
    render(<FormAnuncioFornecedor />);
    expect(screen.getByLabelText('Nome do fornecedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('O que vende')).toBeInTheDocument();
    expect(screen.getByLabelText('Município')).toBeInTheDocument();
    expect(screen.getByLabelText(/WhatsApp/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar cadastro' })).toBeInTheDocument();
  });

  it('envia os campos certos e mostra a confirmação', async () => {
    const f = mockFetch(200, { recebido: true });
    render(<FormAnuncioFornecedor />);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));
    expect(await screen.findByText(/Recebido!/)).toBeInTheDocument();
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({
      nome: 'Casa Agro',
      categoria: 'racao-sal',
      oQueVende: 'ração e sal',
      municipio: 'Redenção',
      whatsapp: '(94) 99999-8888',
      contato: '',
    });
  });

  it('mostra o erro da API', async () => {
    mockFetch(429, { erro: 'Limite diário atingido — tente amanhã.' });
    render(<FormAnuncioFornecedor />);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));
    expect(await screen.findByText(/Limite diário/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/components/FormAnuncioFornecedor.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar `components/FormAnuncioFornecedor.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { CATEGORIAS, type CategoriaFornecedor } from '@/lib/fornecedores';

export function FormAnuncioFornecedor() {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaFornecedor>(CATEGORIAS[0].id);
  const [oQueVende, setOQueVende] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="rounded-xl border border-linha bg-papel p-6">
        <p className="font-display text-xl font-bold text-mata">Recebido!</p>
        <p className="mt-1 text-sm text-tinta/60">Seu cadastro entra na vitrine depois de uma conferência rápida. Obrigado!</p>
      </div>
    );
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const contato = String(new FormData(e.currentTarget).get('contato') ?? '');
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome, categoria, oQueVende, municipio, whatsapp, contato }),
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
        Nome do fornecedor
        <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Categoria
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaFornecedor)} className={campo}>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>{c.rotulo}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        O que vende
        <input type="text" required value={oQueVende} onChange={(e) => setOQueVende(e.target.value)} placeholder="ex.: ração, sal mineral, sementes" className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Município
        <input type="text" required value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        WhatsApp (com DDD)
        <input type="text" inputMode="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="ex.: (94) 99999-8888" className={campo} />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button type="submit" disabled={enviando} className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto">
        {enviando ? 'Enviando…' : 'Enviar cadastro'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Criar `app/fornecedores/anunciar/page.tsx`**

```tsx
import { FormAnuncioFornecedor } from '@/components/FormAnuncioFornecedor';

export const metadata = { title: 'Anunciar — Fornecedores da Praça Araguaia' };

export default function Anunciar() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Fornecedores</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Anuncie na praça</h1>
      <p className="mt-1 text-sm text-tinta/50">Cadastre sua empresa — entra na vitrine depois de uma conferência rápida.</p>
      <div className="mt-6">
        <FormAnuncioFornecedor />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/components/FormAnuncioFornecedor.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add components/FormAnuncioFornecedor.tsx app/fornecedores/anunciar/page.tsx tests/components/FormAnuncioFornecedor.test.tsx
git commit -m "feat: formulario publico de anuncio + pagina /fornecedores/anunciar"
```

---

### Task 5: Vitrine lê do banco + remove o array estático

**Files:**
- Modify: `app/fornecedores/page.tsx`
- Modify: `lib/fornecedores.ts` (remover `export const FORNECEDORES`)
- Modify: `tests/fornecedores.test.ts` (tirar o import de `FORNECEDORES` e o bloco "invariante dos FORNECEDORES curados")

**Interfaces:**
- Consumes: `createPublicClient` (`@/lib/supabase/public`), `Fornecedor`, `CategoriaFornecedor`, `VitrineFornecedores`.
- Produces: página `/fornecedores` dinâmica lendo aprovados.

- [ ] **Step 1: Reescrever `app/fornecedores/page.tsx`**

```tsx
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fornecedores — Praça Araguaia' };

export default async function Fornecedores() {
  const { data } = await createPublicClient()
    .from('fornecedores')
    .select('nome, categoria, o_que_vende, municipio, whatsapp')
    .eq('status', 'aprovado')
    .order('nome');

  const fornecedores: Fornecedor[] = (data ?? []).map((r) => ({
    nome: r.nome as string,
    categoria: r.categoria as CategoriaFornecedor,
    oQueVende: r.o_que_vende as string,
    municipio: r.municipio as string,
    whatsapp: r.whatsapp as string,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Quem atende a praça</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Fornecedores da praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Agropecuárias, revendas e prestadores da região do Araguaia — fale direto no WhatsApp.
      </p>
      <Link
        href="/fornecedores/anunciar"
        className="mt-4 inline-block rounded-lg border border-linha bg-papel px-4 py-2 text-sm font-semibold text-pasto transition hover:border-pasto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Você atende a praça? Anuncie aqui →
      </Link>
      <VitrineFornecedores fornecedores={fornecedores} />
    </main>
  );
}
```

- [ ] **Step 2: Remover o array estático de `lib/fornecedores.ts`**

Apagar as duas linhas:

```ts
// Curada pelo dono. Vazia até os primeiros fornecedores reais entrarem.
export const FORNECEDORES: Fornecedor[] = [];
```

- [ ] **Step 3: Ajustar `tests/fornecedores.test.ts`**

Tirar `FORNECEDORES,` da lista de imports (deixando `linkWhatsApp, agruparPorCategoria, CATEGORIAS, MENSAGEM_PADRAO, normalizarWhatsapp, validarFornecedor, validarDecisaoFornecedor` + os `type`). E **apagar** o bloco inteiro `describe('invariante dos FORNECEDORES curados', ...)` (o invariante do whatsapp agora vive em `validarFornecedor`).

- [ ] **Step 4: Suíte + build**

Run: `npx vitest run`
Expected: PASS (todos).

Run: `npm run build`
Expected: build OK; `/fornecedores` aparece como `ƒ` (dynamic).

- [ ] **Step 5: Commit**

```bash
git add app/fornecedores/page.tsx lib/fornecedores.ts tests/fornecedores.test.ts
git commit -m "feat: vitrine /fornecedores le aprovados do banco + CTA de anuncio; remove array estatico"
```

---

### Task 6: Aba de moderação de fornecedores no `/moderar`

**Files:**
- Modify: `lib/fornecedores.ts` (+ tipo `FornecedorModeravel`)
- Create: `components/FilaFornecedores.tsx`
- Create: `components/AbasModeracao.tsx`
- Modify: `app/moderar/page.tsx`
- Test: `tests/components/FilaFornecedores.test.tsx`

**Interfaces:**
- Consumes: `FornecedorModeravel`, `DecisaoFornecedor` (`@/lib/fornecedores`), `ReportePendente` (`@/lib/moderacao-tipos`), `FilaModeracao`, `CATEGORIAS`, `createServerClient`, `createPublicClient`, `verificarToken`.
- Produces: `<AbasModeracao reportes fornecedoresPendentes fornecedoresAprovados agora />`, `<FilaFornecedores pendentes aprovados />`.

- [ ] **Step 1: Adicionar o tipo `FornecedorModeravel` em `lib/fornecedores.ts`**

Ao fim do arquivo:

```ts
// View-model da moderação (client-safe — sem PII além do contato comercial público).
export type FornecedorModeravel = {
  id: string;
  nome: string;
  categoriaRotulo: string;
  oQueVende: string;
  municipio: string;
  whatsapp: string;
};
```

- [ ] **Step 2: Escrever o teste do `FilaFornecedores` (falhando)**

Criar `tests/components/FilaFornecedores.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilaFornecedores } from '@/components/FilaFornecedores';
import type { FornecedorModeravel } from '@/lib/fornecedores';

beforeEach(() => vi.restoreAllMocks());

const pend: FornecedorModeravel = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  nome: 'Casa Pendente',
  categoriaRotulo: 'Ração e sal',
  oQueVende: 'ração',
  municipio: 'Redenção',
  whatsapp: '5594999998888',
};
const apro: FornecedorModeravel = { ...pend, id: '11111111-1111-1111-1111-111111111111', nome: 'Casa No Ar' };

describe('FilaFornecedores', () => {
  it('mostra pendentes e aprovados', () => {
    render(<FilaFornecedores pendentes={[pend]} aprovados={[apro]} />);
    expect(screen.getByText('Casa Pendente')).toBeInTheDocument();
    expect(screen.getByText('Casa No Ar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover do ar' })).toBeInTheDocument();
  });

  it('Aprovar chama a rota com {id, decisao: aprovado} e some da lista', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }) as never);
    render(<FilaFornecedores pendentes={[pend]} aprovados={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(f).toHaveBeenCalledWith('/api/moderar/fornecedor', expect.objectContaining({ method: 'POST' }));
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toEqual({ id: pend.id, decisao: 'aprovado' });
    // some otimista
    expect(await screen.findByText('Nenhum cadastro pendente.')).toBeInTheDocument();
  });

  it('Remover do ar chama com decisao: removido', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }) as never);
    render(<FilaFornecedores pendentes={[]} aprovados={[apro]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover do ar' }));
    const corpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(corpo).toEqual({ id: apro.id, decisao: 'removido' });
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `npx vitest run tests/components/FilaFornecedores.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 4: Implementar `components/FilaFornecedores.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { FornecedorModeravel, DecisaoFornecedor } from '@/lib/fornecedores';

const btnAprovar = 'rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto';
const btnSecundario = 'rounded-lg border border-linha bg-papel px-4 py-3 text-sm font-semibold text-tinta/70 transition hover:border-tinta/30 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto';

function Cartao({ f, children }: { f: FornecedorModeravel; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-tinta">{f.nome}</h3>
        <span className="text-xs uppercase tracking-[0.08em] text-tinta/50">{f.categoriaRotulo}</span>
      </div>
      <p className="mt-1 text-sm text-tinta/60">{f.oQueVende}</p>
      <p className="mt-0.5 text-sm text-tinta/60">{f.municipio} · {f.whatsapp}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function FilaFornecedores({
  pendentes,
  aprovados,
}: {
  pendentes: FornecedorModeravel[];
  aprovados: FornecedorModeravel[];
}) {
  const [filaPend, setFilaPend] = useState(pendentes);
  const [filaApro, setFilaApro] = useState(aprovados);
  const [erro, setErro] = useState<string | null>(null);

  type Setter = React.Dispatch<React.SetStateAction<FornecedorModeravel[]>>;

  async function decidir(f: FornecedorModeravel, decisao: DecisaoFornecedor, lista: FornecedorModeravel[], setLista: Setter) {
    setErro(null);
    setLista((prev) => prev.filter((x) => x.id !== f.id)); // otimista
    const devolver = () => setLista((prev) => (prev.some((x) => x.id === f.id) ? prev : [f, ...prev]));
    try {
      const res = await fetch('/api/moderar/fornecedor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: f.id, decisao }),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (res.ok || res.status === 404) return; // 404: já resolvido — segue removido
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      devolver();
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
    } catch {
      devolver();
      setErro('Sem conexão. Tente de novo.');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Esperando decisão ({filaPend.length})</h2>
        {filaPend.length === 0 ? (
          <p className="text-sm text-tinta/50">Nenhum cadastro pendente.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filaPend.map((f) => (
              <Cartao key={f.id} f={f}>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => decidir(f, 'aprovado', filaPend, setFilaPend)} className={btnAprovar}>Aprovar</button>
                  <button type="button" onClick={() => decidir(f, 'rejeitado', filaPend, setFilaPend)} className={btnSecundario}>Rejeitar</button>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">No ar ({filaApro.length})</h2>
        {filaApro.length === 0 ? (
          <p className="text-sm text-tinta/50">Nenhum fornecedor no ar ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filaApro.map((f) => (
              <Cartao key={f.id} f={f}>
                <button type="button" onClick={() => decidir(f, 'removido', filaApro, setFilaApro)} className={btnSecundario}>Remover do ar</button>
              </Cartao>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Rodar os testes do componente**

Run: `npx vitest run tests/components/FilaFornecedores.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 6: Criar `components/AbasModeracao.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { FilaModeracao } from '@/components/FilaModeracao';
import { FilaFornecedores } from '@/components/FilaFornecedores';
import type { ReportePendente } from '@/lib/moderacao-tipos';
import type { FornecedorModeravel } from '@/lib/fornecedores';

export function AbasModeracao({
  reportes,
  agora,
  fornecedoresPendentes,
  fornecedoresAprovados,
}: {
  reportes: ReportePendente[];
  agora: number;
  fornecedoresPendentes: FornecedorModeravel[];
  fornecedoresAprovados: FornecedorModeravel[];
}) {
  const [aba, setAba] = useState<'precos' | 'fornecedores'>('precos');
  const tab = (ativo: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto ${
      ativo ? 'bg-mata text-white' : 'border border-linha bg-papel text-tinta/60 hover:bg-linha/60'
    }`;

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <button type="button" onClick={() => setAba('precos')} className={tab(aba === 'precos')}>
          Preços ({reportes.length})
        </button>
        <button type="button" onClick={() => setAba('fornecedores')} className={tab(aba === 'fornecedores')}>
          Fornecedores ({fornecedoresPendentes.length})
        </button>
      </div>
      {aba === 'precos' ? (
        <FilaModeracao pendentes={reportes} agora={agora} />
      ) : (
        <FilaFornecedores pendentes={fornecedoresPendentes} aprovados={fornecedoresAprovados} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Ligar no `app/moderar/page.tsx`**

Trocar o import do `FilaModeracao` por `AbasModeracao` e trazer `CATEGORIAS` + tipo:

```tsx
import { AbasModeracao } from '@/components/AbasModeracao';
import { CATEGORIAS, type FornecedorModeravel } from '@/lib/fornecedores';
```

(remover `import { FilaModeracao } from '@/components/FilaModeracao';`)

Depois do bloco que monta `pendentes` (reportes) e antes do `return`, buscar e mapear os fornecedores:

```tsx
  const { data: forns } = await supabase
    .from('fornecedores')
    .select('id, nome, categoria, o_que_vende, municipio, whatsapp, status')
    .in('status', ['pendente', 'aprovado'])
    .order('criado_em', { ascending: false });

  const rotulo = new Map(CATEGORIAS.map((c) => [c.id, c.rotulo]));
  const paraModeravel = (r: Record<string, unknown>): FornecedorModeravel => ({
    id: r.id as string,
    nome: r.nome as string,
    categoriaRotulo: rotulo.get(r.categoria as never) ?? String(r.categoria),
    oQueVende: r.o_que_vende as string,
    municipio: r.municipio as string,
    whatsapp: r.whatsapp as string,
  });
  const fornecedoresPendentes = (forns ?? []).filter((r) => r.status === 'pendente').map(paraModeravel);
  const fornecedoresAprovados = (forns ?? []).filter((r) => r.status === 'aprovado').map(paraModeravel);
```

Trocar o JSX final:

```tsx
      <div className="mt-8">
        <FilaModeracao pendentes={pendentes} agora={Date.now()} />
      </div>
```

por:

```tsx
      <div className="mt-8">
        <AbasModeracao
          reportes={pendentes}
          agora={Date.now()}
          fornecedoresPendentes={fornecedoresPendentes}
          fornecedoresAprovados={fornecedoresAprovados}
        />
      </div>
```

E o subtítulo `<p className="mt-1 text-sm text-tinta/50">{...}</p>` (que conta só reportes) fica; ele agora descreve a aba de preços — aceitável.

- [ ] **Step 8: Suíte completa + lint + build**

Run: `npx vitest run`
Expected: PASS (todos).

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`

Run: `npm run build`
Expected: build OK; `/moderar` e `/fornecedores` como `ƒ`, `/fornecedores/anunciar` e `/api/fornecedores`, `/api/moderar/fornecedor` listadas.

- [ ] **Step 9: Commit**

```bash
git add lib/fornecedores.ts components/FilaFornecedores.tsx components/AbasModeracao.tsx app/moderar/page.tsx tests/components/FilaFornecedores.test.tsx
git commit -m "feat: aba de moderacao de fornecedores no /moderar (aprovar/rejeitar/remover)"
```

---

## Verificação pós-deploy (manual, após push)

1. **Submissão:** abrir `/fornecedores/anunciar`, cadastrar um fornecedor de teste → "Recebido!". Não aparece ainda em `/fornecedores`.
2. **Moderação:** entrar em `/moderar` (senha), aba **Fornecedores** → o cadastro está em "Esperando decisão". Aprovar.
3. **Vitrine:** `/fornecedores` mostra o fornecedor aprovado, com o botão de WhatsApp.
4. **Remover:** de volta em `/moderar` → "No ar" → Remover do ar → some de `/fornecedores`.
5. **Anti-spam:** enviar 4× seguidas do mesmo IP → a 4ª volta 429.

## Notas para o executor

- **Ordem importa:** Task 1 antes de tudo (as validações). Tasks 2–4 dependem da 1 e são independentes entre si. Task 5 remove o `FORNECEDORES` (precisa da 1). Task 6 depende de 1 e 3.
- Migração (Task 2, Step 1) é a única ação de efeito externo antes do deploy — projeto `eoguwsybosgzfeiqqxjk`.
- Rodar `npx vitest run` (nunca watch).
- Não tocar em testes existentes além do ajuste do bloco invariante em `tests/fornecedores.test.ts` (Task 5).
