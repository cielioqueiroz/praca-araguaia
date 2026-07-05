# Fatia 13B — Envio diário do boletim via Telegram

**Data:** 2026-07-05
**Depende de:** Fatia 13A (bot `@pracaaraguaia_bot`, inscrição + webhook — já no ar).

## Objetivo

Entregar, toda manhã, o card PNG do boletim da Praça Araguaia para todos os
inscritos em `assinantes_telegram`, via `sendPhoto` da Bot API. Grátis, sem
novas dependências.

## Arquitetura

Um **segundo cron** na Vercel dispara `GET /api/enviar-boletim` às **12:20 UTC**
(≈09:20 no fuso America/Araguaina), 20 min depois da coleta das 12:00 — assim os
preços já estão frescos. A rota autentica por `Bearer CRON_SECRET` (mesmo padrão
de `/api/coletar`), lê os `chat_id` de `assinantes_telegram` (service role) e
envia a cada um a imagem do boletim com uma legenda curta. Quem bloqueou o bot
(resposta 403) é removido da lista.

### Como a imagem viaja

`sendPhoto` aceita uma **URL** no campo `photo` — o próprio Telegram baixa a
imagem. Enviamos `https://agroapp-bay.vercel.app/api/boletim?d=YYYY-MM-DD`.
O sufixo `?d=<data>` é um **cache-buster**: `/api/boletim` tem cache de CDN de 1h,
e sem o parâmetro o Telegram poderia baixar uma versão renderizada antes da
coleta. Com a URL datada, cada dia é uma chave de cache distinta → sempre o
boletim fresco do dia. Nenhum byte de imagem passa pela nossa função.

## Componentes

### `lib/telegram.ts` (adição)

```ts
export type ResultadoEnvio = { ok: true } | { ok: false; bloqueado: boolean };

export async function enviarFoto(
  token: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio>;
```

- POST em `https://api.telegram.org/bot{token}/sendPhoto` com corpo JSON
  `{ chat_id, photo: photoUrl, caption }`.
- `res.ok` → `{ ok: true }`.
- `res.status === 403` (bot bloqueado / conta desativada) → `{ ok: false, bloqueado: true }`.
- Qualquer outro status → loga e `{ ok: false, bloqueado: false }`.

### `lib/telegram-boletim.ts` (novo, puro — sem I/O)

```ts
export function legendaBoletim(agora: Date): string;
export function urlFotoBoletim(agora: Date): string;

export type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number };
export async function enviarBoletim(args: {
  chatIds: number[];
  enviar: (chatId: number) => Promise<ResultadoEnvio>;
}): Promise<ResumoEnvio>;
```

- `legendaBoletim` → `"☀️ Bom dia! Cotações da Praça Araguaia — {data em extenso}. Veja o painel completo em agroapp-bay.vercel.app"`, com a data no fuso America/Araguaina usando o mesmo `Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' })` do boletim.
- `urlFotoBoletim` → `https://agroapp-bay.vercel.app/api/boletim?d={YYYY-MM-DD no fuso America/Araguaina}`.
- `enviarBoletim` → orquestrador puro: percorre `chatIds`, chama `enviar(chatId)`, acumula `enviados`, coleta `bloqueados` (ids com `bloqueado: true`) e conta `falhas` (erros não-bloqueio). Não faz I/O direto — o efeito é injetado por `enviar`.

### `app/api/enviar-boletim/route.ts` (novo)

- `export const dynamic = 'force-dynamic';` e `export const maxDuration = 60;`
- Auth: `authorization !== 'Bearer ' + process.env.CRON_SECRET` → **401**.
- Falta `TELEGRAM_BOT_TOKEN` → **500**.
- Lê `chat_id` de `assinantes_telegram` (service role via `createServerClient`).
  Erro na leitura → **500** logado.
- Monta `url = urlFotoBoletim(agora)` e `caption = legendaBoletim(agora)`.
- Chama `enviarBoletim({ chatIds, enviar: (id) => enviarFoto(token, id, url, caption) })`.
- Apaga os `bloqueados`: `supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados)` (só quando a lista não é vazia; escopado por `in`).
- Responde **200** com JSON `{ enviados, removidos: bloqueados.length, falhas }`.
- Lista de inscritos vazia → **200** com `{ enviados: 0, removidos: 0, falhas: 0 }`.

### `vercel.json` (adição)

```json
{
  "crons": [
    { "path": "/api/coletar", "schedule": "0 12 * * *" },
    { "path": "/api/enviar-boletim", "schedule": "20 12 * * *" }
  ]
}
```

A Vercel injeta `Authorization: Bearer <CRON_SECRET>` automaticamente quando a env
`CRON_SECRET` existe (já existe, usada pela coleta).

## Tratamento de erros

| Situação | Resposta |
|---|---|
| Bearer errado/ausente | 401, sem tocar no banco |
| Falta `TELEGRAM_BOT_TOKEN` | 500 |
| Erro ao ler `assinantes_telegram` | 500 logado |
| Envio individual falha (não-403) | loga, conta em `falhas`, segue os demais |
| Envio individual 403 | marca pra remoção; apaga todos ao fim |
| Lista de inscritos vazia | 200, `{ enviados: 0 }` |

## Fora de escopo (YAGNI — anotado para depois)

- **Reuso de `file_id`** (enviar 1× e reaproveitar o id nos demais, em vez de N
  downloads pelo Telegram): otimização só relevante com muitos inscritos.
- **Throttle de taxa** (Telegram ~30 msg/s): desnecessário no volume atual.
- **Dedup/idempotência**: o cron dispara 1×/dia sem retry automático; falha no
  meio se corrige no dia seguinte. Sem tabela de controle.

## Testes

- `enviarFoto`: chama `.../sendPhoto` com `{ chat_id, photo, caption }`; `ok:true`
  em 200; `bloqueado:true` em 403; `bloqueado:false` em outro erro (fetch mockado).
- `legendaBoletim`: data fixa `2026-07-05T13:00:00Z` → contém "5 de julho" e o link.
- `urlFotoBoletim`: mesma data → URL com `?d=2026-07-05`.
- `enviarBoletim`: `[1,2,3]` com envio ok para 1 e 3 e 403 para 2 →
  `{ enviados: 2, bloqueados: [2], falhas: 0 }`; erro não-403 conta em `falhas`.
- Rota (espelha `tests/api/telegram.test.ts`): 401 com bearer errado; 500 sem env;
  caminho feliz seleciona os chat_ids, chama `enviarFoto` por inscrito e apaga
  bloqueados via `.in`; lista vazia → 200.

## Segurança e privacidade

- Nenhum dado novo além do `chat_id` já guardado. Tabela com RLS fechada, acesso
  só via service role no servidor.
- Endpoint protegido por `CRON_SECRET`; não é público.
- Token do bot vive só nas env vars da Vercel.
