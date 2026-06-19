# Fatia Vertical Fina — Cotação do Dólar (Praça Araguaia)

> Design doc — 2026-06-19
> Primeiro sub-projeto da plataforma Praça Araguaia (ver `conceito-praca-araguaia.md`).
> Objetivo: provar a arquitetura **coleta → banco → painel** de ponta a ponta com a fonte mais simples e confiável, deixando o caminho aberto para boi/soja/etc.

---

## 1. Contexto e decisão de escopo

O documento de conceito descreve uma plataforma em 3 fases com vários subsistemas independentes
(coleta automatizada, painel de cotações, Termômetro da Praça, boletim/distribuição, marketplace, comunidade).
Cada um terá seu próprio ciclo spec → plano → implementação.

Esta spec cobre **apenas a primeira fatia vertical fina** — o passo #3 do item 12 do conceito —
que prova a arquitetura central antes de investir nos subsistemas grandes.

**Decisões tomadas no brainstorming:**

| Decisão | Escolha | Motivo |
|---|---|---|
| Ponto de partida | Fatia vertical fina | Prova arquitetura ponta a ponta com risco mínimo |
| Primeira fonte | Dólar via API pública — **AwesomeAPI** (`economia.awesomeapi.com.br/last/USD-BRL`) como primária; BCB como alternativa se necessário | Confiável, sem auth, sem risco jurídico, tempo real — sem fragilidade de scraping |
| Coleta/agendamento | Route Handler + Vercel Cron (1×/dia) | Exercita o fluxo automatizado real do produto |
| Escopo da tela | Valor atual + gravar histórico | Banco completo, UI mínima; gráfico vem de graça numa fatia futura |
| Infra | Do zero (Supabase via MCP + Vercel) | Nenhum projeto criado ainda |

**Fora de escopo nesta fatia (YAGNI):** auth/usuários, gráfico de tendência, scraping (CEPEA/B3/IMEA),
boletim/card, Termômetro da Praça, marketplace, alertas.

---

## 2. Arquitetura e fluxo de dados

```
[AwesomeAPI dólar  (BCB fallback)]
        │  fetch
        ▼
[Route Handler  /api/coletar]  ◄── Vercel Cron (1×/dia)  + proteção por CRON_SECRET
        │  upsert + insert (service role)
        ▼
[Supabase Postgres]
   ├─ cotacoes            (1 linha por tipo: último valor "vivo")
   └─ cotacoes_historico  (série temporal, append-only)
        │  select (anon key, leitura pública via RLS)
        ▼
[Página /  — Server Component]  → mostra valor atual + variação + data
```

- **Coleta:** server-side apenas; usa a *service role key* (nunca exposta ao client).
- **Leitura:** Server Component com a *anon key*; RLS permite `SELECT` público e bloqueia escrita.
- **Proteção do cron:** a rota exige header com `CRON_SECRET` — não pode ser disparada por qualquer um.

---

## 3. Modelo de dados

```sql
-- Último valor "vivo" por tipo (1 linha por tipo). A tela lê daqui.
create table cotacoes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null unique,        -- 'dolar' (depois: boi_gordo, soja…)
  valor           numeric(12,4) not null,
  unidade         text not null,               -- 'R$'
  variacao_pct    numeric(6,2),                -- variação vs. coleta anterior
  fonte           text not null,               -- 'awesomeapi'
  data_referencia timestamptz not null,        -- timestamp do dado na fonte
  atualizado_em   timestamptz not null default now()
);

-- Série temporal append-only. Alimenta o gráfico numa fatia futura.
create table cotacoes_historico (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,
  valor           numeric(12,4) not null,
  fonte           text not null,
  data_referencia timestamptz not null,
  created_at      timestamptz not null default now()
);
create index on cotacoes_historico (tipo, data_referencia desc);
```

**Decisões:**
- `tipo` é `text` com `unique` em `cotacoes` (não enum) → coleta faz `upsert ... on conflict (tipo)`
  sem dor e adiciona boi/soja sem migração de enum.
- `variacao_pct` é calculada na coleta comparando com a linha mais recente do histórico antes de inserir a nova.
- `numeric`, não `float`, para dinheiro.

**RLS (desde o início):**
- Ambas as tabelas: `SELECT` liberado para o role `anon` (dado público).
- `INSERT/UPDATE`: nada via anon — só a *service role* (ignora RLS) usada pela rota de coleta.

---

## 4. Componentes e estrutura de arquivos

```
agro_app/
├─ app/
│  ├─ page.tsx                  # Server Component: lê cotacoes, renderiza painel
│  ├─ layout.tsx                # shell + fonte + metadata
│  ├─ globals.css               # Tailwind
│  └─ api/
│     └─ coletar/route.ts       # rota protegida: coleta → grava
├─ lib/
│  ├─ supabase/
│  │  ├─ server.ts              # client com service role (só server)
│  │  └─ public.ts              # client com anon key (leitura)
│  ├─ fontes/
│  │  └─ dolar.ts               # fetch + parse da AwesomeAPI → Cotacao
│  └─ coleta.ts                 # orquestra: busca fonte, calcula variação, upsert+insert
├─ types/cotacao.ts             # tipo Cotacao compartilhado
├─ components/
│  └─ CardCotacao.tsx           # apresentação pura (valor, variação, data)
├─ supabase/migrations/         # SQL versionado das tabelas + RLS
├─ vercel.json                  # cron: /api/coletar 1×/dia
├─ .env.local.example           # vars necessárias
└─ ...config (next, tailwind, tsconfig, eslint)
```

**Unidades isoladas:**

| Unidade | Faz | Depende de |
|---|---|---|
| `lib/fontes/dolar.ts` | Busca o dólar na API, devolve `Cotacao` normalizado. Não conhece banco. | `fetch` |
| `lib/coleta.ts` | Calcula variação vs. último histórico; upsert em `cotacoes` + insert em `cotacoes_historico`. | `fontes/*`, `supabase/server` |
| `api/coletar/route.ts` | Valida `CRON_SECRET`, chama `coleta`, devolve status. | `lib/coleta` |
| `components/CardCotacao.tsx` | Renderiza um valor de cotação. Sem fetch, sem estado. | props |
| `app/page.tsx` | Lê cotações e monta o painel. | `supabase/public`, `CardCotacao` |

A fonte é separada da coleta para que **adicionar boi/soja depois seja só criar `fontes/boi.ts`** e registrar,
sem tocar na orquestração. Esse é o ponto que prova a arquitetura.

```ts
export type Cotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  fonte: string;
  dataReferencia: string; // ISO
};
```

**Variáveis de ambiente:**
- `NEXT_PUBLIC_SUPABASE_URL` — leitura no client/server
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — leitura pública (RLS aplicada)
- `SUPABASE_SERVICE_ROLE_KEY` — só server, usada pela coleta
- `CRON_SECRET` — protege `/api/coletar`

---

## 5. Tratamento de erros

| Cenário | Comportamento |
|---|---|
| API do dólar fora do ar / timeout | Coleta falha **sem gravar nada**. Rota 502 + log. Último valor bom permanece na tela. |
| Resposta da API em formato inesperado | `fontes/dolar.ts` valida o shape (valor numérico > 0, data presente) antes de devolver; inválido → erro, não grava. |
| Falha de escrita no Supabase | Upsert + insert tratados como uma operação lógica; falha → sem estado inconsistente; retorna 500. |
| Rota chamada sem `CRON_SECRET` | 401, não executa coleta. |
| Banco vazio (sem cotação ainda) | Estado vazio explícito ("ainda sem cotação — rode a coleta"), não tela quebrada. |
| Dado velho (última coleta > 48h) | Card marca "desatualizado" com a data — nunca finge ser de hoje. |

A fonte nunca confia na API externa cegamente: valida tipo e faixa antes de aceitar.

---

## 6. Testes

TDD na implementação:

- **`fontes/dolar.ts`** (unit, fetch mockado): resposta válida → `Cotacao` correto; malformada → erro; valor zero/negativo → erro.
- **`lib/coleta.ts`** (unit, Supabase mockado): calcula `variacao_pct` certo contra o histórico;
  primeira coleta (sem histórico) → variação nula, não quebra; falha de escrita propaga erro.
- **`api/coletar/route.ts`**: sem secret → 401; com secret + coleta ok → 200; coleta lança → 5xx.
- **Smoke manual** (`verification-before-completion`): rodar a coleta real contra a API uma vez,
  confirmar linha no Supabase e valor na tela antes de declarar pronto.

Sem testes de RLS automatizados nesta fatia (policies validadas manualmente no painel do Supabase).

---

## 7. Critérios de sucesso

1. `npm run dev` sobe o app sem erros.
2. Migrations criam `cotacoes` e `cotacoes_historico` com RLS aplicada no Supabase.
3. Chamar `/api/coletar` com `CRON_SECRET` grava/atualiza a cotação do dólar e adiciona linha no histórico.
4. A página `/` mostra o valor atual do dólar, a variação e a data da última coleta.
5. Testes unitários passam.
6. Vercel Cron configurado para chamar `/api/coletar` 1×/dia.

---

## 8. Próximas fatias (fora deste spec)

- Gráfico de tendência (consome `cotacoes_historico` já acumulado).
- Adicionar fontes: boi gordo, soja, milho (novos `fontes/*.ts`).
- Termômetro da Praça (reporte anônimo + moderação + auth).
- Boletim/card (Satori) para Instagram/WhatsApp.
