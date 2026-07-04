# Termômetro T2 — UI de Moderação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/moderar` protegida por senha para aprovar/rejeitar a fila de reportes pendentes do Termômetro pelo celular.

**Architecture:** Lógica pura de sessão em `lib/moderacao.ts` (token HMAC assinado com a própria senha, cookie HttpOnly de 30 dias); duas API routes (`/api/moderar/login` e `/api/moderar/decidir`, service role); página server component que renderiza login ou fila conforme o cookie; fila client component com remoção otimista.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, `node:crypto` (HMAC/timingSafeEqual), Supabase (service role), Tailwind v4 com tokens do projeto, Vitest + Testing Library.

## Global Constraints

- **Zero dependências novas.** Só `node:crypto` e o que já está no `package.json`.
- **Sem migração de banco.** A tabela `reportes` (status `pendente`/`aprovado`/`rejeitado`) já existe.
- Env var nova: `MODERACAO_SENHA` (`.env.local` + Vercel). Ausente → login responde 500 `"Moderação não configurada."`.
- Cookie: nome `moderacao`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` de 30 dias, `Secure` só quando `NODE_ENV === 'production'`.
- Token: `"{expira}.{assinatura}"`, `expira` = epoch ms + 30 dias, assinatura = HMAC-SHA256(chave = senha, mensagem = `"moderador.{expira}"`) em hex. Comparações via `timingSafeEqual`.
- Login com espera fixa de 800 ms em toda resposta (0 ms quando `NODE_ENV === 'test'`).
- Update de decisão restrito a `status = 'pendente'`; 0 linhas afetadas → 404 `"Reporte não encontrado ou já moderado."` (sem SELECT prévio).
- Copy exata: `"Senha incorreta."`, `"Sessão inválida — entre de novo."`, `"Fila limpa — nenhum reporte pendente."`, `"Não consegui carregar a fila — tente recarregar."`.
- `/moderar` NÃO entra no menu do `Header`; metadata com `robots: { index: false }`.
- Visual: tokens da fatia 7 (`mata`, `pasto`, `palha`, `papel`, `linha`, `tinta`), `font-display` + `tabular-nums` para valores, botões com área de toque generosa (mobile-first).
- Textos de UI em português brasileiro.
- Em Next 15, `cookies()` de `next/headers` é **assíncrono** (`await cookies()`).

---

### Task 1: Lógica pura de moderação (`lib/moderacao.ts`)

**Files:**
- Create: `lib/moderacao.ts`
- Test: `tests/moderacao.test.ts`

**Interfaces:**
- Consumes: nada do projeto (só `node:crypto`).
- Produces (usados pelas Tasks 2–5):
  - `COOKIE_MODERACAO = 'moderacao'`, `VALIDADE_TOKEN_MS` (30 dias em ms)
  - `criarToken(agora: number, senha: string): string`
  - `verificarToken(token: string, agora: number, senha: string): boolean`
  - `verificarSenha(tentativa: string, senha: string): boolean`
  - `lerTokenDoCookie(header: string | null): string | null`
  - `validarDecisao(body: unknown): ValidacaoDecisao` com `type ValidacaoDecisao = { tipo: 'invalido'; erro: string } | { tipo: 'valido'; id: string; decisao: 'aprovado' | 'rejeitado' }`
  - `tempoRelativo(iso: string, agora: number): string`
  - `type ReportePendente = { id: string; rotulo: string; unidade: string; valor: number; municipio: string; criadoEm: string; mediaConab?: number }`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/moderacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  criarToken,
  verificarToken,
  verificarSenha,
  lerTokenDoCookie,
  validarDecisao,
  tempoRelativo,
  VALIDADE_TOKEN_MS,
} from '@/lib/moderacao';

const SENHA = 'senha-forte-de-teste';
const AGORA = 1_751_600_000_000; // instante fixo

describe('token de moderação', () => {
  it('ida e volta: token criado agora é válido', () => {
    const token = criarToken(AGORA, SENHA);
    expect(verificarToken(token, AGORA, SENHA)).toBe(true);
  });

  it('ainda vale um pouco antes de expirar, expira depois de 30 dias', () => {
    const token = criarToken(AGORA, SENHA);
    expect(verificarToken(token, AGORA + VALIDADE_TOKEN_MS - 1, SENHA)).toBe(true);
    expect(verificarToken(token, AGORA + VALIDADE_TOKEN_MS, SENHA)).toBe(false);
  });

  it('rejeita assinatura adulterada', () => {
    const token = criarToken(AGORA, SENHA);
    const [expira, assinatura] = token.split('.');
    const adulterada = (assinatura[0] === 'a' ? 'b' : 'a') + assinatura.slice(1);
    expect(verificarToken(`${expira}.${adulterada}`, AGORA, SENHA)).toBe(false);
  });

  it('rejeita expiração adulterada (assinatura não bate mais)', () => {
    const token = criarToken(AGORA, SENHA);
    const [, assinatura] = token.split('.');
    expect(verificarToken(`${AGORA + VALIDADE_TOKEN_MS * 2}.${assinatura}`, AGORA, SENHA)).toBe(false);
  });

  it('rejeita token assinado com outra senha (troca de senha derruba sessões)', () => {
    const token = criarToken(AGORA, 'senha-antiga');
    expect(verificarToken(token, AGORA, SENHA)).toBe(false);
  });

  it('rejeita formatos inválidos sem lançar', () => {
    for (const lixo of ['', 'abc', '123', '123.', '.abc', 'x.y.z', `${AGORA}.zzzz-não-hex`]) {
      expect(verificarToken(lixo, AGORA, SENHA)).toBe(false);
    }
  });
});

describe('verificarSenha', () => {
  it('aceita a senha certa e rejeita errada/vazia', () => {
    expect(verificarSenha(SENHA, SENHA)).toBe(true);
    expect(verificarSenha('errada', SENHA)).toBe(false);
    expect(verificarSenha('', SENHA)).toBe(false);
  });
});

describe('lerTokenDoCookie', () => {
  it('extrai o cookie moderacao entre outros cookies', () => {
    expect(lerTokenDoCookie('a=1; moderacao=123.abc; b=2')).toBe('123.abc');
    expect(lerTokenDoCookie('moderacao=123.abc')).toBe('123.abc');
  });

  it('devolve null sem header, sem o cookie ou com valor vazio', () => {
    expect(lerTokenDoCookie(null)).toBeNull();
    expect(lerTokenDoCookie('a=1; b=2')).toBeNull();
    expect(lerTokenDoCookie('moderacao=')).toBeNull();
  });
});

describe('validarDecisao', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('aceita aprovado e rejeitado com UUID válido', () => {
    expect(validarDecisao({ id: uuid, decisao: 'aprovado' })).toEqual({ tipo: 'valido', id: uuid, decisao: 'aprovado' });
    expect(validarDecisao({ id: uuid, decisao: 'rejeitado' })).toEqual({ tipo: 'valido', id: uuid, decisao: 'rejeitado' });
  });

  it('rejeita body não-objeto, id fora do formato UUID e decisão fora dos literais', () => {
    expect(validarDecisao(null).tipo).toBe('invalido');
    expect(validarDecisao('x').tipo).toBe('invalido');
    expect(validarDecisao({ id: 'abc', decisao: 'aprovado' }).tipo).toBe('invalido');
    expect(validarDecisao({ id: uuid, decisao: 'pendente' }).tipo).toBe('invalido');
    expect(validarDecisao({ id: uuid, decisao: 'DELETE' }).tipo).toBe('invalido');
  });
});

describe('tempoRelativo', () => {
  const min = 60_000;

  it('minutos, horas e dias em pt-BR', () => {
    expect(tempoRelativo(new Date(AGORA - 15 * min).toISOString(), AGORA)).toBe('há 15 min');
    expect(tempoRelativo(new Date(AGORA - 2 * 60 * min).toISOString(), AGORA)).toBe('há 2 h');
    expect(tempoRelativo(new Date(AGORA - 24 * 60 * min).toISOString(), AGORA)).toBe('há 1 dia');
    expect(tempoRelativo(new Date(AGORA - 3 * 24 * 60 * min).toISOString(), AGORA)).toBe('há 3 dias');
  });

  it('nunca negativo (relógio adiantado vira "há 0 min")', () => {
    expect(tempoRelativo(new Date(AGORA + min).toISOString(), AGORA)).toBe('há 0 min');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/moderacao.test.ts`
Expected: FAIL — `Cannot find module '@/lib/moderacao'` (ou equivalente).

- [ ] **Step 3: Implementar `lib/moderacao.ts`**

```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_MODERACAO = 'moderacao';
export const VALIDADE_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// Assinado com a própria senha: trocar a senha derruba todas as sessões.
function assinar(expira: number, senha: string): string {
  return createHmac('sha256', senha).update(`moderador.${expira}`).digest('hex');
}

export function criarToken(agora: number, senha: string): string {
  const expira = agora + VALIDADE_TOKEN_MS;
  return `${expira}.${assinar(expira, senha)}`;
}

export function verificarToken(token: string, agora: number, senha: string): boolean {
  const [expiraStr, assinatura, ...sobra] = token.split('.');
  const expira = Number(expiraStr);
  if (sobra.length > 0 || !Number.isFinite(expira) || !assinatura) return false;
  if (agora >= expira) return false;
  const recebida = Buffer.from(assinatura, 'hex');
  const esperada = Buffer.from(assinar(expira, senha), 'hex');
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

// SHA-256 de ambas iguala os comprimentos, exigência do timingSafeEqual.
export function verificarSenha(tentativa: string, senha: string): boolean {
  const a = createHash('sha256').update(tentativa).digest();
  const b = createHash('sha256').update(senha).digest();
  return timingSafeEqual(a, b);
}

export function lerTokenDoCookie(header: string | null): string | null {
  if (!header) return null;
  for (const par of header.split(';')) {
    const [nome, ...resto] = par.trim().split('=');
    if (nome === COOKIE_MODERACAO) {
      const valor = resto.join('=');
      return valor === '' ? null : valor;
    }
  }
  return null;
}

export type Decisao = 'aprovado' | 'rejeitado';

export type ValidacaoDecisao =
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; id: string; decisao: Decisao };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarDecisao(body: unknown): ValidacaoDecisao {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) {
    return { tipo: 'invalido', erro: 'Reporte inválido.' };
  }
  if (b.decisao !== 'aprovado' && b.decisao !== 'rejeitado') {
    return { tipo: 'invalido', erro: 'Decisão inválida.' };
  }
  return { tipo: 'valido', id: b.id, decisao: b.decisao };
}

export function tempoRelativo(iso: string, agora: number): string {
  const minutos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// Forma que a página /moderar entrega para a FilaModeracao (produto já resolvido).
export type ReportePendente = {
  id: string;
  rotulo: string;
  unidade: string;
  valor: number;
  municipio: string;
  criadoEm: string; // ISO
  mediaConab?: number;
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/moderacao.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/moderacao.ts tests/moderacao.test.ts
git commit -m "feat: logica pura de sessao e decisao da moderacao"
```

---

### Task 2: `POST /api/moderar/login`

**Files:**
- Create: `app/api/moderar/login/route.ts`
- Modify: `.env.local.example` (acrescentar linha `MODERACAO_SENHA=`)
- Modify: `.env.local` (definir uma senha local para testes manuais)
- Test: `tests/api/moderar-login.test.ts`

**Interfaces:**
- Consumes (Task 1): `criarToken(agora, senha)`, `verificarSenha(tentativa, senha)`, `COOKIE_MODERACAO`, `VALIDADE_TOKEN_MS`.
- Produces: `POST /api/moderar/login` com body `{ senha: string }` → 200 + `Set-Cookie`, 401 `"Senha incorreta."`, 500 `"Moderação não configurada."`.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/api/moderar-login.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/moderar/login/route';
import { verificarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const req = (body: unknown) =>
  new Request('http://localhost/api/moderar/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.stubEnv('MODERACAO_SENHA', 'senha-de-teste'));
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/login', () => {
  it('500 quando MODERACAO_SENHA não está configurada', async () => {
    vi.stubEnv('MODERACAO_SENHA', '');
    const res = await POST(req({ senha: 'qualquer' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ erro: 'Moderação não configurada.' });
  });

  it('401 para senha errada, sem Set-Cookie', async () => {
    const res = await POST(req({ senha: 'errada' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: 'Senha incorreta.' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('401 para body sem senha ou não-JSON', async () => {
    expect((await POST(req({}))).status).toBe(401);
    const semJson = new Request('http://localhost/api/moderar/login', { method: 'POST', body: 'x' });
    expect((await POST(semJson)).status).toBe(401);
  });

  it('200 para senha certa, com cookie HttpOnly assinado e verificável', async () => {
    const res = await POST(req({ senha: 'senha-de-teste' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${COOKIE_MODERACAO}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 30}`);
    expect(cookie).not.toContain('Secure'); // fora de produção
    const token = cookie.split(';')[0].split('=')[1];
    expect(verificarToken(token, Date.now(), 'senha-de-teste')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/moderar-login.test.ts`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar `app/api/moderar/login/route.ts`**

```ts
import { criarToken, verificarSenha, COOKIE_MODERACAO } from '@/lib/moderacao';

export const dynamic = 'force-dynamic';

// Espera fixa em TODA resposta: freia força bruta sem vazar timing.
const ESPERA_MS = process.env.NODE_ENV === 'test' ? 0 : 800;
const espera = () => new Promise((r) => setTimeout(r, ESPERA_MS));

export async function POST(req: Request) {
  const senha = process.env.MODERACAO_SENHA;
  if (!senha) {
    return Response.json({ erro: 'Moderação não configurada.' }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // corpo inválido cai no caminho de senha errada, com a mesma espera
  }
  const tentativa =
    typeof body === 'object' && body !== null && typeof (body as { senha?: unknown }).senha === 'string'
      ? ((body as { senha: string }).senha)
      : '';

  await espera();
  if (!verificarSenha(tentativa, senha)) {
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const token = criarToken(Date.now(), senha);
  const atributos = [
    `${COOKIE_MODERACAO}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (process.env.NODE_ENV === 'production') atributos.push('Secure');

  return Response.json({ ok: true }, { headers: { 'set-cookie': atributos.join('; ') } });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/moderar-login.test.ts`
Expected: PASS.

- [ ] **Step 5: Acrescentar a env var**

Em `.env.local.example`, acrescentar ao final:

```
MODERACAO_SENHA=
```

Em `.env.local` (não versionado), definir um valor local, ex.: `MODERACAO_SENHA=senha-local-dev`.

- [ ] **Step 6: Commit**

```bash
git add app/api/moderar/login/route.ts tests/api/moderar-login.test.ts .env.local.example
git commit -m "feat: login da moderacao com cookie assinado"
```

---

### Task 3: `POST /api/moderar/decidir`

**Files:**
- Create: `app/api/moderar/decidir/route.ts`
- Test: `tests/api/moderar-decidir.test.ts`

**Interfaces:**
- Consumes (Task 1): `lerTokenDoCookie`, `verificarToken`, `validarDecisao`, `criarToken` (nos testes), `COOKIE_MODERACAO`; e `createServerClient()` de `@/lib/supabase/server`.
- Produces: `POST /api/moderar/decidir` com body `{ id: string; decisao: 'aprovado' | 'rejeitado' }` → 200 `{ ok: true }`, 401 sessão inválida, 400 body inválido, 404 já moderado/não encontrado, 500 erro de banco.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/api/moderar-decidir.test.ts` (mock encadeável no padrão de `tests/api/reportar.test.ts`):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { POST } from '@/app/api/moderar/decidir/route';
import { createServerClient } from '@/lib/supabase/server';
import { criarToken, COOKIE_MODERACAO } from '@/lib/moderacao';

const SENHA = 'senha-de-teste';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

// update(...).eq('id', ...).eq('status', 'pendente').select('id')
function mockSupabase({ linhas = [{ id: UUID }], error = null }: { linhas?: { id: string }[]; error?: unknown } = {}) {
  const select = vi.fn(async () => ({ data: error ? null : linhas, error }));
  const eqStatus = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqStatus }));
  const update = vi.fn(() => ({ eq: eqId }));
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ update })),
  });
  return { update, eqId, eqStatus };
}

const req = (body: unknown, cookie?: string) =>
  new Request('http://localhost/api/moderar/decidir', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const cookieValido = () => `${COOKIE_MODERACAO}=${criarToken(Date.now(), SENHA)}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODERACAO_SENHA', SENHA);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/moderar/decidir', () => {
  it('401 sem cookie, com token adulterado ou sem senha configurada', async () => {
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

  it('200 aprova: update com filtro id + status pendente', async () => {
    const { update, eqId, eqStatus } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: 'aprovado' });
    expect(eqId).toHaveBeenCalledWith('id', UUID);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pendente');
  });

  it('200 rejeita com decisao rejeitado', async () => {
    const { update } = mockSupabase();
    const res = await POST(req({ id: UUID, decisao: 'rejeitado' }, cookieValido()));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: 'rejeitado' });
  });

  it('404 quando nenhuma linha pendente foi afetada (já moderado)', async () => {
    mockSupabase({ linhas: [] });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: 'Reporte não encontrado ou já moderado.' });
  });

  it('500 quando o banco falha', async () => {
    mockSupabase({ error: { message: 'boom' } });
    const res = await POST(req({ id: UUID, decisao: 'aprovado' }, cookieValido()));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/moderar-decidir.test.ts`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar `app/api/moderar/decidir/route.ts`**

```ts
import { createServerClient } from '@/lib/supabase/server';
import { lerTokenDoCookie, verificarToken, validarDecisao } from '@/lib/moderacao';

export const dynamic = 'force-dynamic';

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
  const validacao = validarDecisao(body);
  if (validacao.tipo === 'invalido') {
    return Response.json({ erro: validacao.erro }, { status: 400 });
  }

  // Só pendente pode ser decidido; as linhas afetadas dizem se algo mudou (sem TOCTOU).
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('reportes')
    .update({ status: validacao.decisao })
    .eq('id', validacao.id)
    .eq('status', 'pendente')
    .select('id');
  if (error) {
    return Response.json({ erro: 'Erro ao salvar. Tente de novo.' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ erro: 'Reporte não encontrado ou já moderado.' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/moderar-decidir.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/moderar/decidir/route.ts tests/api/moderar-decidir.test.ts
git commit -m "feat: rota de decisao da moderacao (aprovar/rejeitar pendente)"
```

---

### Task 4: Componentes client — `FormLoginModeracao` e `FilaModeracao`

**Files:**
- Create: `components/FormLoginModeracao.tsx`
- Create: `components/FilaModeracao.tsx`
- Test: `tests/components/FormLoginModeracao.test.tsx`
- Test: `tests/components/FilaModeracao.test.tsx`

**Interfaces:**
- Consumes (Task 1): `tempoRelativo(iso, agora)`, `type ReportePendente`; rotas das Tasks 2 e 3 via `fetch`.
- Produces:
  - `FormLoginModeracao()` — sem props; POST `/api/moderar/login`; sucesso → `router.refresh()`.
  - `FilaModeracao({ pendentes, agora }: { pendentes: ReportePendente[]; agora: number })` — POST `/api/moderar/decidir`; remoção otimista com rollback; 401 → `window.location.reload()`; 404 → mantém removido (já foi moderado).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `tests/components/FormLoginModeracao.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { FormLoginModeracao } from '@/components/FormLoginModeracao';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function preencherEEnviar(senha: string) {
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: senha } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
}

describe('FormLoginModeracao', () => {
  it('senha certa: envia para /api/moderar/login e dá refresh', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FormLoginModeracao />);
    preencherEEnviar('minha-senha');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/moderar/login');
    expect(JSON.parse(String(init.body))).toEqual({ senha: 'minha-senha' });
  });

  it('senha errada: mostra o erro do servidor e não dá refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Senha incorreta.' }), { status: 401 })));
    render(<FormLoginModeracao />);
    preencherEEnviar('errada');
    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sem conexão: mostra mensagem de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    render(<FormLoginModeracao />);
    preencherEEnviar('x');
    expect(await screen.findByText('Sem conexão. Tente de novo.')).toBeInTheDocument();
  });
});
```

Criar `tests/components/FilaModeracao.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilaModeracao } from '@/components/FilaModeracao';
import type { ReportePendente } from '@/lib/moderacao';

const AGORA = 1_751_600_000_000;

const pendentes: ReportePendente[] = [
  {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    rotulo: 'Boi gordo',
    unidade: 'R$/@',
    valor: 335,
    municipio: 'Vila Rica',
    criadoEm: new Date(AGORA - 2 * 60 * 60_000).toISOString(),
    mediaConab: 326.96,
  },
  {
    id: '8b1f9e22-1234-4cde-9f00-aabbccddeeff',
    rotulo: 'Bezerro',
    unidade: 'R$/cabeça',
    valor: 2800,
    municipio: 'Confresa',
    criadoEm: new Date(AGORA - 30 * 60_000).toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('FilaModeracao', () => {
  it('mostra os cards com valor, município, tempo relativo e referência CONAB', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    expect(screen.getByText('Boi gordo')).toBeInTheDocument();
    expect(screen.getByText('335')).toBeInTheDocument();
    expect(screen.getByText('Vila Rica')).toBeInTheDocument();
    expect(screen.getByText('há 2 h')).toBeInTheDocument();
    expect(screen.getByText(/CONAB: 326,96/)).toBeInTheDocument();
    expect(screen.getByText('Bezerro')).toBeInTheDocument();
    expect(screen.queryAllByText(/CONAB:/)).toHaveLength(1); // bezerro não tem referência
  });

  it('fila vazia mostra a mensagem de fila limpa', () => {
    render(<FilaModeracao pendentes={[]} agora={AGORA} />);
    expect(screen.getByText('Fila limpa — nenhum reporte pendente.')).toBeInTheDocument();
  });

  it('aprovar remove o card na hora e envia a decisão', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    expect(screen.queryByText('Boi gordo')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/moderar/decidir');
    expect(JSON.parse(String(init.body))).toEqual({ id: pendentes[0].id, decisao: 'aprovado' });
  });

  it('rejeitar envia decisao rejeitado', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rejeitar' })[1]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      id: pendentes[1].id,
      decisao: 'rejeitado',
    });
  });

  it('falha do servidor devolve o card e mostra o erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Erro ao salvar. Tente de novo.' }), { status: 500 })));
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    expect(await screen.findByText('Erro ao salvar. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByText('Boi gordo')).toBeInTheDocument(); // voltou
  });

  it('404 (já moderado) mantém o card removido, sem erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Reporte não encontrado ou já moderado.' }), { status: 404 })));
    render(<FilaModeracao pendentes={pendentes} agora={AGORA} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    await waitFor(() => expect(screen.queryByText('Boi gordo')).not.toBeInTheDocument());
    expect(screen.queryByText(/não encontrado/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/FormLoginModeracao.test.tsx tests/components/FilaModeracao.test.tsx`
Expected: FAIL — componentes não existem.

- [ ] **Step 3: Implementar `components/FormLoginModeracao.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FormLoginModeracao() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/moderar/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (res.ok) {
        router.refresh(); // recarrega a página já autenticada; botão fica desabilitado até lá
        return;
      }
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
      setEnviando(false);
    } catch {
      setErro('Sem conexão. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-tinta/70">
        Senha
        <input
          type="password"
          required
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto"
        />
      </label>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implementar `components/FilaModeracao.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { tempoRelativo, type ReportePendente, type Decisao } from '@/lib/moderacao';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function FilaModeracao({ pendentes, agora }: { pendentes: ReportePendente[]; agora: number }) {
  const [fila, setFila] = useState(pendentes);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: string, decisao: Decisao) {
    const anterior = fila;
    setErro(null);
    setFila(anterior.filter((r) => r.id !== id)); // otimista: some na hora
    try {
      const res = await fetch('/api/moderar/decidir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, decisao }),
      });
      if (res.status === 401) {
        window.location.reload(); // sessão expirou → cai na tela de senha
        return;
      }
      if (res.ok || res.status === 404) return; // 404: já moderado — segue removido
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      setFila(anterior);
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
    } catch {
      setFila(anterior);
      setErro('Sem conexão. Tente de novo.');
    }
  }

  if (fila.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
        <p className="font-display text-lg font-bold text-mata">Fila limpa — nenhum reporte pendente.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
      {fila.map((r) => (
        <div key={r.id} className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{r.rotulo}</h2>
            <span className="text-xs text-tinta/40">{tempoRelativo(r.criadoEm, agora)}</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-tinta">
            {fmt.format(r.valor)} <span className="text-sm font-semibold text-pasto">{r.unidade}</span>
          </p>
          <p className="mt-1 text-sm text-tinta/60">{r.municipio}</p>
          {r.mediaConab !== undefined && (
            <p className="mt-1 text-xs text-tinta/50">CONAB: {fmt.format(r.mediaConab)}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => decidir(r.id, 'aprovado')}
              className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => decidir(r.id, 'rejeitado')}
              className="rounded-lg border border-linha bg-papel px-4 py-3 text-sm font-semibold text-tinta/70 transition hover:border-tinta/30 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              Rejeitar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/components/FormLoginModeracao.test.tsx tests/components/FilaModeracao.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/FormLoginModeracao.tsx components/FilaModeracao.tsx tests/components/FormLoginModeracao.test.tsx tests/components/FilaModeracao.test.tsx
git commit -m "feat: componentes de login e fila da moderacao"
```

---

### Task 5: Página `/moderar` + verificação completa

**Files:**
- Create: `app/moderar/page.tsx`

**Interfaces:**
- Consumes: `verificarToken`, `COOKIE_MODERACAO`, `type ReportePendente` (Task 1); `FormLoginModeracao` e `FilaModeracao` (Task 4); `createServerClient` (`@/lib/supabase/server`), `createPublicClient` (`@/lib/supabase/public`), `PRODUTOS` e `type ProdutoTermometro` (`@/lib/termometro`); `cookies` de `next/headers` (**assíncrono no Next 15**).
- Produces: página final. Sem teste unitário de página (padrão do projeto: páginas são verificadas por build + e2e manual).

- [ ] **Step 1: Implementar `app/moderar/page.tsx`**

```tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { verificarToken, COOKIE_MODERACAO, type ReportePendente } from '@/lib/moderacao';
import { PRODUTOS, type ProdutoTermometro } from '@/lib/termometro';
import { FormLoginModeracao } from '@/components/FormLoginModeracao';
import { FilaModeracao } from '@/components/FilaModeracao';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Moderação — Praça Araguaia',
  robots: { index: false },
};

export default async function Moderar() {
  const senha = process.env.MODERACAO_SENHA;
  const token = (await cookies()).get(COOKIE_MODERACAO)?.value;
  const autenticado = Boolean(senha && token && verificarToken(token, Date.now(), senha));

  if (!autenticado) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Área restrita</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Moderação</h1>
        <p className="mt-1 text-sm text-tinta/50">Entre com a senha para ver a fila de reportes.</p>
        <div className="mt-6">
          <FormLoginModeracao />
        </div>
      </main>
    );
  }

  // Pendentes só existem para o service role (a RLS esconde do anon).
  const supabase = createServerClient();
  const { data: reportes, error } = await supabase
    .from('reportes')
    .select('id, produto, municipio, valor, criado_em')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mata">Moderação</h1>
        <div className="mt-6 rounded-xl border border-linha bg-papel p-6">
          <p className="text-sm font-medium text-red-600">Não consegui carregar a fila — tente recarregar.</p>
        </div>
      </main>
    );
  }

  const { data: cotacoes } = await createPublicClient().from('cotacoes').select('tipo, valor');
  const conab = new Map((cotacoes ?? []).map((c) => [c.tipo as string, Number(c.valor)]));

  const pendentes: ReportePendente[] = (reportes ?? []).map((r) => {
    const produto = PRODUTOS[r.produto as ProdutoTermometro];
    return {
      id: r.id as string,
      rotulo: produto?.rotulo ?? String(r.produto),
      unidade: produto?.unidade ?? '',
      valor: Number(r.valor),
      municipio: r.municipio as string,
      criadoEm: r.criado_em as string,
      mediaConab: conab.get(r.produto as string),
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Área restrita</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Moderação</h1>
      <p className="mt-1 text-sm text-tinta/50">
        {pendentes.length === 0
          ? 'Nenhum reporte esperando decisão.'
          : `${pendentes.length} ${pendentes.length === 1 ? 'reporte esperando' : 'reportes esperando'} decisão.`}
      </p>
      <div className="mt-8">
        <FilaModeracao pendentes={pendentes} agora={Date.now()} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Suíte completa, build e lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: todos os testes PASS (132 antigos + os novos), build e lint limpos.

- [ ] **Step 3: Verificação e2e manual (dev server local)**

Com `MODERACAO_SENHA` definida em `.env.local` e `npm run dev` rodando:

1. `http://localhost:3000/moderar` sem cookie → tela de senha.
2. Senha errada → "Senha incorreta." (com ~800 ms de espera).
3. Senha certa → fila (vazia ou não), cookie `moderacao` HttpOnly no DevTools.
4. Criar um reporte de teste via `POST /api/reportar` (ex.: boi 320 em Redenção) → aparece na fila com valor, município, "há 0 min" e linha CONAB.
5. Aprovar → card some; reporte aparece em `/termometro`; repetir a decisão via curl com o mesmo id → 404.
6. Rejeitar um segundo reporte de teste → some da fila e NÃO aparece em `/termometro`.
7. Limpar os dados de teste no banco.

Expected: os 7 passos se comportam como descrito.

- [ ] **Step 4: Commit**

```bash
git add app/moderar/page.tsx
git commit -m "feat: pagina /moderar com login e fila de pendentes"
```

---

## Depois das tasks (controlador da sessão)

1. Review final da branch inteira (fable) — padrão das fatias anteriores.
2. Definir `MODERACAO_SENHA` nas Environment Variables da Vercel **antes do push** (senha forte, gerada).
3. Push com aprovação explícita do usuário → deploy automático.
4. E2E em produção: login, aprovar/rejeitar reporte de teste, conferir `/termometro`, apagar dados de teste.
5. Atualizar `ESTADO-DO-PROJETO.md` (fatia 9) e memória.
