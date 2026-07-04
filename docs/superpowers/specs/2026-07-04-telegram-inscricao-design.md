# Bot de Telegram — Inscrição + Webhook (design)

> Fatia 13, sub-fatia A. A fundação do bot: responder a `/start` (inscrever) e `/parar`
> (sair), guardando os inscritos numa tabela, via webhook seguro. Grátis (Telegram Bot
> API), sem dependências novas. As sub-fatias B (envio do boletim) e C (alertas) dependem
> desta.

## Objetivo

Dar ao produtor um canal gratuito para receber, no Telegram, o boletim diário e (depois)
alertas de preço. Esta sub-fatia entrega o essencial: o bot recebe `/start` e passa a
conhecer o produtor (guarda o `chat_id`); `/parar` o remove. Sem inscritos não há para
quem enviar nada — por isso é a primeira peça. O consentimento é explícito (o produtor
inicia a conversa) e o único dado guardado é o `chat_id` do Telegram.

## Decisões de design

- **Webhook, não polling** — a Vercel é serverless (sem processo de longa duração), então
  o Telegram faz `POST` para `/api/telegram` a cada mensagem. Polling exigiria um worker
  persistente.
- **Segurança por secret token** — ao registrar o webhook, passamos um `secret_token`; o
  Telegram o devolve no header `X-Telegram-Bot-Api-Secret-Token` em toda chamada.
  Conferimos contra `TELEGRAM_WEBHOOK_SECRET`.
- **`/parar` apaga o registro** — retenção mínima; re-`/start` reinscreve (upsert
  idempotente). Sem flag de "inativo".
- **Só o `chat_id`** — nenhuma outra PII. RLS fecha a tabela para o público.
- **Responder 200 rápido** — o Telegram re-tenta em respostas não-200; o webhook nunca
  deixa um erro interno virar retry infinito (erros são logados e a resposta é 200).

## Arquitetura

```
supabase/migrations/0004_assinantes_telegram.sql  # tabela + RLS
lib/telegram.ts                                    # interpretarUpdate + enviarMensagem + textos
app/api/telegram/route.ts                          # webhook: verifica secret, roteia comando
```

Sem dependências novas (só `fetch` para `api.telegram.org`). Reaproveita `createServerClient`.

### `supabase/migrations/0004_assinantes_telegram.sql`

```sql
create table assinantes_telegram (
  chat_id bigint primary key,
  criado_em timestamptz not null default now()
);

alter table assinantes_telegram enable row level security;
-- Sem policy: nega tudo por padrão. Só o service role (webhook) acessa.
revoke all on assinantes_telegram from anon, authenticated;
```

### `lib/telegram.ts` (lógica pura + envio)

```ts
export type IntencaoTelegram =
  | { tipo: 'start'; chatId: number }
  | { tipo: 'parar'; chatId: number }
  | { tipo: 'ajuda'; chatId: number }
  | { tipo: 'ignorar' };

export function interpretarUpdate(update: unknown): IntencaoTelegram;
export async function enviarMensagem(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl?: typeof fetch,
): Promise<void>;
```

- `interpretarUpdate`: lê `update.message.text` e `update.message.chat.id`. Se não houver
  mensagem de texto com `chat.id` numérico → `{ tipo: 'ignorar' }`. Texto começando com
  `/start` → `start`; `/parar` → `parar`; qualquer outro texto → `ajuda`. O match é no
  começo do texto (ignora argumentos e é case-insensitive no comando).
- `enviarMensagem`: `POST https://api.telegram.org/bot{token}/sendMessage` com
  `{ chat_id, text }` (JSON). Usa `fetchImpl ?? fetch`. Erros de rede são propagados
  (o chamador decide o que fazer); a função não lança por status != 2xx do Telegram além
  de logar (mantém o webhook resiliente).
- Textos (constantes exportadas): `TEXTO_BOAS_VINDAS` (explica que o produtor vai receber
  o boletim diário da Praça Araguaia e como sair com `/parar`), `TEXTO_DESPEDIDA`,
  `TEXTO_AJUDA` (lista `/start` e `/parar`).

### `app/api/telegram/route.ts`

```ts
export const dynamic = 'force-dynamic';
export async function POST(req: Request): Promise<Response>
```

1. Confere `req.headers.get('x-telegram-bot-api-secret-token')` contra
   `process.env.TELEGRAM_WEBHOOK_SECRET`. Diferente/ausente → `401`.
   Se `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_WEBHOOK_SECRET` ausentes no ambiente → `500`.
2. `const update = await req.json()` (corpo inválido → responde `200` e ignora, para não
   gerar retry do Telegram).
3. `interpretarUpdate(update)`:
   - `start`: `upsert({ chat_id }, { onConflict: 'chat_id', ignoreDuplicates: true })` em
     `assinantes_telegram` (service role) + `enviarMensagem(BOAS_VINDAS)`.
   - `parar`: `delete().eq('chat_id', chatId)` + `enviarMensagem(DESPEDIDA)`.
   - `ajuda`: `enviarMensagem(AJUDA)`.
   - `ignorar`: nada.
4. Sempre retorna `200` (mesmo se o envio/DB falhar — o erro é logado via `console.error`;
   não deixamos o Telegram re-tentar em loop).

## Casos de borda

- **Secret errado/ausente:** `401`, sem tocar no banco.
- **Env do bot ausente:** `500` (config incompleta).
- **Corpo não-JSON ou update sem mensagem:** `200` sem ação (`ignorar`).
- **`/start` repetido:** upsert idempotente — não duplica nem falha.
- **`/parar` de quem não é inscrito:** delete não afeta linhas; ainda envia a despedida.
- **Falha do `sendMessage` ou do banco:** logada; resposta segue `200`.

## Testes (Vitest, padrão do projeto)

`tests/telegram.test.ts`:
- `interpretarUpdate`: `/start` → `{ tipo: 'start', chatId }`; `/parar` → `parar`;
  `/start@bot algo` → `start` (ignora sufixo/args); texto qualquer ("oi") → `ajuda`;
  update sem `message.text` → `ignorar`; `chat.id` ausente → `ignorar`.
- `enviarMensagem`: chama a URL `…/bot{token}/sendMessage` com `{ chat_id, text }` no corpo
  (fetch mockado); usa o `fetchImpl` injetado.

`tests/api/telegram.test.ts` (Supabase e fetch mockados, no padrão de `reportar`):
- header secret errado/ausente → `401`, sem chamar o banco;
- env ausente → `500`;
- `/start` → `upsert` em `assinantes_telegram` + `sendMessage` de boas-vindas, `200`;
- `/parar` → `delete().eq('chat_id', …)` + despedida, `200`;
- texto qualquer → ajuda, `200`, sem tocar no banco;
- update sem texto → `200`, sem ação.

## Deploy / operação

1. Criar o bot no **@BotFather** → obter `TELEGRAM_BOT_TOKEN`.
2. Gerar `TELEGRAM_WEBHOOK_SECRET` (string forte).
3. Cadastrar as duas env vars no projeto Vercel (Production), server-only.
4. Aplicar a migração `0004` **antes** do deploy (via MCP/CLI, como a `0003`).
5. Deploy (push).
6. Registrar o webhook uma vez:
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://agroapp-bay.vercel.app/api/telegram" -d "secret_token=<SECRET>"`.
7. Verificar: mandar `/start` ao bot → receber boas-vindas; conferir a linha em
   `assinantes_telegram`; `/parar` → despedida + linha removida. Limpar o `chat_id` de
   teste.

## Fora do escopo (sub-fatias seguintes)

Envio diário do boletim (sub-fatia B, via cron + `sendPhoto` do PNG); alertas de preço
com limite por usuário (sub-fatia C); comandos extras (`/boletim` sob demanda); menu de
comandos no BotFather. Nada disto entra aqui.
