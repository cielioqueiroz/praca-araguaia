# Praça Araguaia 🌾

> Fonte diária de informação do produtor rural da região do Araguaia (sul do PA / nordeste do MT): cotações que importam, atualizadas todo dia.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-38BDF8?logo=tailwindcss&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres_+_RLS-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Cron-000000?logo=vercel&logoColor=white">
  <img alt="Testes" src="https://img.shields.io/badge/testes-63_passando-brightgreen?logo=vitest&logoColor=white">
</p>

Plataforma de **cotações agropecuárias** da região do Araguaia. No ar com **dólar, euro e ouro** (painel + gráficos), construída em fatias verticais finas sobre a arquitetura **coleta → banco → painel**.

- 🟢 **Estado atual e ponto de retomada:** [`ESTADO-DO-PROJETO.md`](ESTADO-DO-PROJETO.md)
- 📄 Conceito completo do produto: [`conceito-praca-araguaia.md`](conceito-praca-araguaia.md)

---

## O que já existe

Um app Next.js 15 que:

1. **Coleta** a cotação USD→BRL de uma API pública (AwesomeAPI), validando o dado antes de aceitar.
2. **Calcula** a variação percentual contra a última cotação registrada.
3. **Grava** o valor atual em `cotacoes` (upsert) e a série temporal em `cotacoes_historico` (append-only) no Supabase.
4. **Exibe** o valor, a variação e a data num painel, marcando dados desatualizados (> 48h).
5. **Agenda** a coleta diária via Vercel Cron, com a rota protegida por segredo.

```
┌─────────────────────────┐
│ AwesomeAPI (USD-BRL)     │   BRT, validado (valor > 0, data presente)
└────────────┬────────────┘
             │ fetch
             ▼
┌─────────────────────────┐   Vercel Cron 1×/dia
│ GET /api/coletar         │ ◄── Authorization: Bearer CRON_SECRET
└────────────┬────────────┘
             │ service role (upsert + insert)
             ▼
┌─────────────────────────┐
│ Supabase / PostgreSQL    │   RLS: leitura pública, escrita só service role
│  • cotacoes              │
│  • cotacoes_historico    │
└────────────┬────────────┘
             │ anon key (select)
             ▼
┌─────────────────────────┐
│ /  (Server Component)    │   CardCotacao: valor, variação, data
└─────────────────────────┘
```

A **fonte de dados é desacoplada da orquestração** (`lib/fontes/*` ↔ `lib/coleta.ts` via a porta `CotacaoRepo`), então adicionar boi, soja ou milho é só criar um novo `fontes/*.ts` — sem tocar no resto.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front + back | Next.js 15 (App Router), TypeScript (strict), Tailwind CSS |
| Banco / Auth | Supabase (PostgreSQL + RLS) |
| Coleta agendada | Route Handler + Vercel Cron |
| Testes | Vitest + Testing Library |
| Deploy | Vercel |

---

## Estrutura

```
agro_app/
├─ app/
│  ├─ page.tsx                  # Painel (Server Component, lê via anon key)
│  ├─ layout.tsx
│  └─ api/coletar/route.ts      # Coleta protegida por CRON_SECRET
├─ lib/
│  ├─ fontes/dolar.ts           # Busca + valida o dólar (AwesomeAPI)
│  ├─ coleta.ts                 # Orquestração pura (fonte + repo, calcula variação)
│  └─ supabase/
│     ├─ server.ts              # Client service role (só servidor)
│     ├─ public.ts              # Client anon (leitura)
│     └─ repo.ts                # CotacaoRepo sobre supabase-js
├─ components/CardCotacao.tsx   # Apresentação pura de uma cotação
├─ types/cotacao.ts            # Tipo Cotacao + porta CotacaoRepo
├─ supabase/migrations/         # DDL + RLS versionado
├─ tests/                       # Unitários (21 testes)
├─ vercel.json                  # Cron diário → /api/coletar
└─ docs/superpowers/            # Spec e plano de implementação
```

---

## Começando

### 1. Pré-requisitos

- Node.js 18.18+ (recomendado 20+)
- Uma conta [Supabase](https://supabase.com)

### 2. Instalar

```bash
npm install
```

### 3. Banco de dados (Supabase)

Crie um projeto no Supabase e aplique a migration:

- **Supabase Studio:** SQL Editor → cole o conteúdo de [`supabase/migrations/0001_cotacoes.sql`](supabase/migrations/0001_cotacoes.sql) → Run.
- **Ou Supabase CLI:** `supabase db push` (com o projeto vinculado).

Isso cria `cotacoes` e `cotacoes_historico` com RLS (leitura pública, escrita só service role).

### 4. Variáveis de ambiente

Copie o exemplo e preencha com os valores do seu projeto (Project Settings → API):

```bash
cp .env.local.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=...            # service role — NUNCA expor no client
CRON_SECRET=...                          # qualquer segredo forte e aleatório
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` é usada **apenas no servidor** (coleta). Nunca a coloque numa variável `NEXT_PUBLIC_*`.

### 5. Rodar

```bash
npm run dev          # http://localhost:3000
```

Dispare a coleta uma vez (a tela começa vazia até a primeira coleta):

```bash
curl -H "authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/coletar
```

Recarregue a página — o card do dólar aparece.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build |
| `npm test` | Roda os testes (Vitest) |
| `npm run test:watch` | Testes em watch mode |
| `npm run lint` | ESLint |

---

## Deploy (Vercel)

1. Conecte o repositório à Vercel.
2. Defina as 4 variáveis de ambiente (as mesmas do `.env.local`) no projeto Vercel.
3. Deploy. O agendamento em [`vercel.json`](vercel.json) chama `/api/coletar` 1×/dia (11:00 UTC ≈ 08:00 BRT); a Vercel injeta automaticamente `Authorization: Bearer ${CRON_SECRET}` nas chamadas do cron.

---

## Modelo de dados

```sql
cotacoes              -- último valor "vivo" por tipo (1 linha por tipo)
  tipo, valor, unidade, variacao_pct, fonte, data_referencia, atualizado_em

cotacoes_historico    -- série temporal append-only (alimenta gráficos futuros)
  tipo, valor, fonte, data_referencia, created_at
```

RLS ativa desde o início: `SELECT` liberado para `anon`; `INSERT/UPDATE/DELETE` revogados do `anon`/`authenticated` (escrita só via service role).

---

## Roadmap

- [x] Painel de cotações + coleta diária do dólar (fatia 1)
- [x] Gráfico de tendência em `/cotacao/[tipo]` (toggle 7/30/90, backfill via `/api/backfill`)
- [x] Novas fontes: euro (Frankfurter) e ouro (gold-api × USD-BRL) — coleta/backfill multi-fonte
- [ ] Commodities: boi gordo, soja, milho (fonte a definir)
- [ ] Termômetro da Praça (reporte anônimo + moderação + média semanal)
- [ ] Boletim diário em card (Satori) para Instagram/WhatsApp
- [ ] Previsão de chuva por município
- [ ] Vitrine de insumos e fornecedores

Cada fatia segue o ciclo spec → plano → implementação, documentado em [`docs/superpowers/`](docs/superpowers/).

---

## Licença

Projeto privado. Todos os direitos reservados.
