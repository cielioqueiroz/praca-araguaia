# Fatia 13C — Alertas de movimento forte via Telegram

**Data:** 2026-07-06
**Depende de:** Fatia 13A (bot `@pracaaraguaia_bot`, inscrição + webhook) e 13B
(broadcast do boletim) — ambas no ar.

## Objetivo

Quando uma cotação se move **≥ ±3%** num **novo** ponto de preço, avisar todos os
inscritos em `assinantes_telegram` com **um único digest** por dia listando o que
se moveu. Vale para as 6 cotações (boi, soja, milho, dólar, euro, ouro). Grátis,
sem novas dependências.

## Arquitetura

Um **terceiro cron** na Vercel dispara `GET /api/alertas` às **12:25 UTC**
(≈09:25 America/Araguaina), depois da coleta (12:00) e do boletim (12:20), com os
preços já frescos. A rota autentica por `Bearer CRON_SECRET` (mesmo padrão de
`/api/coletar` e `/api/enviar-boletim`), lê o snapshot da tabela `cotacoes`
(service role), filtra quem cruzou o limite, remove os já avisados (dedup) e — se
sobrar algo **novo** — monta o digest e faz broadcast por `sendMessage` a todos
os inscritos. Reaproveita o padrão do `enviar-boletim`: broadcast + remoção de
quem bloqueou o bot (403).

Nenhum estado além do necessário: a `cotacoes` já guarda `valor`, `unidade`,
`variacao_pct` e `data_referencia` por tipo (a coleta calcula a variação contra o
ponto anterior).

### Dedup — por que é necessário

A `variacao_pct` do boi/soja/milho (CONAB, semanal) **permanece igual a semana
inteira**: o mesmo ponto de preço é recoletado todo dia até chegar dado novo. Um
alerta ingênuo dispararia o mesmo aviso 7 dias seguidos. Regra: um mover só vira
alerta se o par `(tipo, data_referencia)` **ainda não estiver** em
`alertas_enviados`. Assim cada ponto de preço gera no máximo um alerta.

## Migração — tabela `alertas_enviados`

Aplicada via Supabase MCP (`apply_migration`). RLS ligada **sem policy pública**
(só service role no servidor, igual `reportes`/`assinantes_telegram`).

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

## Componentes

### `lib/telegram.ts` (adição)

```ts
export async function enviarTexto(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl?: typeof fetch,
): Promise<ResultadoEnvio>;
```

- POST em `.../sendMessage` com `{ chat_id, text }`.
- `res.ok` → `{ ok: true }`; `403` → `{ ok: false, bloqueado: true }`; outro →
  loga e `{ ok: false, bloqueado: false }` (mesma forma do `enviarFoto`).
- `enviarMensagem` (usado pelo webhook, assinatura `void`) passa a **delegar** em
  `enviarTexto` e ignorar o retorno — sem mudar seu contrato.

### `lib/telegram-broadcast.ts` (novo, puro)

Extrai o orquestrador genérico que hoje vive como `enviarBoletim` em
`telegram-boletim.ts` (o corpo já é genérico — só o nome era específico):

```ts
export type ResumoEnvio = { enviados: number; bloqueados: number[]; falhas: number };
export async function enviarEmMassa(args: {
  chatIds: number[];
  enviar: (chatId: number) => Promise<ResultadoEnvio>;
}): Promise<ResumoEnvio>;
```

Decisão concreta: `enviarBoletim` é **renomeado** para `enviarEmMassa` e movido
para cá junto com `ResumoEnvio`. A rota `app/api/enviar-boletim/route.ts` passa a
importar `enviarEmMassa` de `telegram-broadcast`; `telegram-boletim.ts` deixa de
exportar o orquestrador (segue com `legendaBoletim`/`urlFotoBoletim`). Os testes
do orquestrador migram para `tests/telegram-broadcast.test.ts`.

### `lib/telegram-alertas.ts` (novo, puro — sem I/O)

```ts
export const LIMITE_ALERTA_PCT = 3;

export type Mover = { tipo: string; variacaoPct: number; valor: number; unidade: string; dataReferencia: string };

export function detectarMovers(
  linhas: Array<{ tipo: string; valor: number; unidade: string; variacao_pct: number | null; data_referencia: string }>,
  limite?: number, // default LIMITE_ALERTA_PCT
): Mover[];

export function montarMensagemAlerta(movers: Mover[], agora: Date): string;
```

- `detectarMovers` → mantém só linhas com `variacao_pct !== null` e
  `Math.abs(variacao_pct) >= limite`; ordena por `ORDEM_PAINEL` (mesma do painel);
  devolve os campos já normalizados.
- `montarMensagemAlerta` → digest com cabeçalho datado (dia+mês em
  America/Araguaina via `Intl`), uma linha por mover
  (`▲/▼ {TITULO}  {+/-}{pct}%   {unidade} {valor}`, `%` e valor em `pt-BR`,
  valor no mesmo formato do boletim: 2–4 casas) e o link do painel.

### `app/api/alertas/route.ts` (novo)

- `export const dynamic = 'force-dynamic';` e `export const maxDuration = 60;`
- Auth: `authorization !== 'Bearer ' + CRON_SECRET` → **401** sem tocar no banco.
- Falta `TELEGRAM_BOT_TOKEN` → **500**.
- Lê `cotacoes` (`tipo, valor, unidade, variacao_pct, data_referencia`) via
  service role. Erro → **500** logado.
- `movers = detectarMovers(linhas)`.
- Lê `alertas_enviados` os pares `(tipo, data_referencia)` dos movers; filtra os
  **novos** (não presentes). Nenhum novo → **200**
  `{ alertados: 0, enviados: 0, removidos: 0, falhas: 0 }` sem enviar nada.
- Monta `texto = montarMensagemAlerta(novos, agora)`; lê `chat_id` de
  `assinantes_telegram`; `enviarEmMassa({ chatIds, enviar: (id) => enviarTexto(token, id, texto) })`.
- Remove bloqueados: `assinantes_telegram.delete().in('chat_id', bloqueados)` (só
  se houver).
- Insere os marcadores dos `novos` em `alertas_enviados`
  (`{ tipo, data_referencia, variacao_pct }`) **após** o broadcast.
- **200** com `{ alertados: novos.length, enviados, removidos: bloqueados.length, falhas }`.

### `vercel.json` (adição)

```json
{ "path": "/api/alertas", "schedule": "25 12 * * *" }
```

A Vercel injeta `Authorization: Bearer <CRON_SECRET>` (env já existe).

## Formato da mensagem (exemplo)

```
🚨 Praça Araguaia — movimento forte hoje (6 de julho)
▲ Boi gordo  +4,2%   R$/@ 340,10
▼ Soja       −3,5%   R$/sc 128,40
Painel completo: agroapp-bay.vercel.app
```

▲/▼ são texto puro do Telegram (sem o problema de glifo do Satori que o boletim
PNG tinha).

## Tratamento de erros

| Situação | Resposta |
|---|---|
| Bearer errado/ausente | 401, sem tocar no banco |
| Falta `TELEGRAM_BOT_TOKEN` | 500 |
| Erro ao ler `cotacoes` | 500 logado |
| Sem movers novos | 200, `{ alertados: 0, enviados: 0, ... }`, nada enviado |
| Envio individual 403 | marca pra remoção; apaga todos ao fim |
| Envio individual falha (não-403) | loga, conta em `falhas`, segue |
| Lista de inscritos vazia | 200; marcadores ainda são inseridos (move vira "notícia velha", não fica em backlog) |
| Broadcast lança (rede) | propaga 500; marcadores não inseridos → retry no dia seguinte |

## Fora de escopo (YAGNI — anotado)

- **Preço-alvo pessoal** e comandos de configuração no bot (`/alertas`, cadastro
  de limites por usuário) — exigiria estado por inscrito e UI de conversa.
- **Alerta intraday**: a coleta roda 1×/dia, então 1 checagem/dia basta.
- **Throttle de taxa** e **reuso de conexão**: volume atual não exige.
- **Limite por grupo/tipo**: um só ±3% para todos (decisão do brainstorming).

## Testes

- `detectarMovers`: linhas com `|variacao| ≥ 3` entram; `< 3` e `null` saem;
  ordem = `ORDEM_PAINEL`; campos normalizados.
- `montarMensagemAlerta`: data fixa `2026-07-06T13:00:00Z` → contém "6 de julho",
  o título, o `%` com sinal e o link; ▲ para alta, ▼ para baixa.
- `enviarTexto`: POST em `.../sendMessage` com `{ chat_id, text }`; `ok:true` em
  200; `bloqueado:true` em 403; `bloqueado:false` em outro erro (fetch mockado).
- `enviarEmMassa`: cobertura atual do orquestrador movida para
  `tests/telegram-broadcast.test.ts` (mesmos casos: enviados/bloqueados/falhas,
  lista vazia, uma chamada por chatId).
- Rota `/api/alertas` (espelha `enviar-boletim.test.ts`): 401 com bearer
  errado/ausente; 500 sem token; 500 em erro de leitura; caminho feliz seleciona
  os movers novos, envia por inscrito e **insere marcadores**; dedup: mover já em
  `alertas_enviados` é filtrado → não envia; sem movers → 200 zero; remove
  bloqueados via `.in`.

## Segurança e privacidade

- Nenhum dado novo de usuário além do `chat_id` já guardado. `alertas_enviados`
  não tem PII (tipo/data/variação). RLS fechada, acesso só via service role.
- Endpoint protegido por `CRON_SECRET`; não é público.
- Token do bot vive só nas env vars da Vercel.
