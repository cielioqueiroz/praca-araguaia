# Praça Araguaia 🌾

> Fonte diária de informação do produtor rural da região do Araguaia (sul do PA / nordeste do MT): cotações que importam, o preço da praça na voz de quem está na lida, chuva e boletim — tudo grátis, atualizado todo dia.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres_+_RLS-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Cron_+_ISR-000000?logo=vercel&logoColor=white">
  <img alt="Testes" src="https://img.shields.io/badge/testes-281_passando-brightgreen?logo=vitest&logoColor=white">
</p>

Plataforma de **informação agropecuária** da região do Araguaia. No ar em **[agroapp-bay.vercel.app](https://agroapp-bay.vercel.app)** com seis cotações, boletim diário, previsão de chuva e o **Termômetro da Praça** — construída em fatias verticais finas, cada uma com spec, plano, testes e deploy verificado.

- 🟢 **Estado atual e ponto de retomada:** [`ESTADO-DO-PROJETO.md`](ESTADO-DO-PROJETO.md)
- 📄 Conceito completo do produto: [`conceito-praca-araguaia.md`](conceito-praca-araguaia.md)
- 🧭 Specs e planos de cada fatia: [`docs/superpowers/`](docs/superpowers/)

---

## Prévia

<p align="center">
  <img src="docs/screenshots/home.jpg" alt="A praça hoje — painel de cotações da Praça Araguaia" width="100%">
</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/cards.jpg" alt="Cards de cotação com foto do produto"><br>
      <sub><b>Na porteira</b> — cada card abre com a foto do produto, que escurece e revela preço, variação e tendência.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/chuva.jpg" alt="Previsão de chuva da região"><br>
      <sub><b>Chuva</b> — a sua região primeiro e depois os municípios da praça, 7 dias.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/mercado.jpg" alt="Câmbio e reservas: dólar, euro e ouro"><br>
      <sub><b>Mercado</b> — dólar, euro e ouro, com mini-tendência de 30 dias.</sub>
    </td>
    <td width="50%" valign="top" align="center">
      <img src="docs/screenshots/boletim.png" alt="Boletim do dia em PNG" width="72%"><br>
      <sub><b>Boletim do dia</b> — card PNG pronto para o Telegram/WhatsApp.</sub>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile.png" alt="Versão mobile da Praça Araguaia" width="250"><br>
  <sub>Responsivo do celular à mesa.</sub>
</p>

---

## O que já está no ar

| Página | O que oferece |
|---|---|
| **`/`** — a praça hoje | Seis cotações: **boi gordo, soja, milho** (CONAB) + **dólar, euro, ouro** (câmbio/mercado), em cards editoriais com **mini-tendência (sparkline)**, máx/mín, variação e selo de "desatualizado". Topo com **ticker** de mercado e a **cidade/UF + temperatura do usuário** (geolocalização). |
| **`/cotacao/[tipo]`** | Gráfico de tendência de cada cotação, com toggle **7 / 30 / 90 dias**. |
| **`/boletim`** | Card-resumo do dia em **PNG 1080×1080** (via `next/og`/Satori) pronto para Instagram/WhatsApp, com botão de download. Enviado também no **Telegram** todo dia. |
| **`/chuva`** | **Sua região primeiro** (previsão da localização do usuário) e depois os 5 municípios da praça — chuva, probabilidade e temperatura de 7 dias (Open-Meteo). |
| **`/termometro`** | **Termômetro da Praça**: o "valor típico" (mediana) dos preços reportados por produtores nos últimos 7 dias, por produto e município, contrastado com a referência CONAB. |
| **`/termometro/reportar`** | Reporte de preço **anônimo** (sem cadastro), com faixa de plausibilidade, honeypot e limite por IP. |
| **`/fornecedores`** | Vitrine de fornecedores da praça (contato direto por WhatsApp). Qualquer um se cadastra em **`/fornecedores/anunciar`**; só entra no ar depois da moderação. |
| **`/calculadora`** | Calculadora do produtor: valor do lote de boi (peso + rendimento) e da colheita de grãos, com o preço da praça já preenchido. |
| **`/moderar`** | Moderação **pelo celular** (senha): abas de **preços** e **fornecedores** — aprovar/rejeitar/remover sem abrir o banco. |

Tudo apoiado em **fontes públicas e gratuitas** (CONAB, BCB, Frankfurter, gold-api, Open-Meteo, Vercel Geo) — sem provedores pagos e sem dados pessoais. Alertas e boletim também chegam pelo bot **[@pracaaraguaia_bot](https://t.me/pracaaraguaia_bot)** no Telegram.

---

## Identidade visual

Direção **"fazenda moderna premium"** — editorial, paleta terra, sem cara de dashboard genérico.

| Elemento | Escolha |
|---|---|
| **Tipografia** | **Playfair Display** (display serifada, títulos) · **Archivo** (UI e números) · **JetBrains Mono** (dados, ticker, timestamps) — via `next/font` |
| **Paleta** | Areia (`bone` `#F1EBDE`), papel (`#FBF8F1`), oliva (`#3F4A24`), couro (`#6E3E1E`), ocre (`#B4863B`); alta em **musgo** (`#6B8339`), baixa em **tijolo** (`#A63A26`) e chuva em **água** (`#45707C`) — nunca neon |
| **Marca** | Monograma **PA**, favicon e banner OG próprios |
| **Assinatura** | Cards que abrem com a **foto do produto** (escurece e revela os dados), grão de papel sutil, filetes finos, ticker de pregão rolante e o hero com foto real de Nelore |

Os tokens vivem no `@theme` do Tailwind v4 (`app/globals.css`); os componentes do sistema estão em `components/redesign/`.

---

## Arquitetura

Duas trilhas de dados: a **coleta agendada** das cotações (cron diário) e o **fluxo de reportes** do Termômetro (anônimo, moderado). Ambas convergem no Supabase, e as páginas leem com a chave `anon` sob RLS.

```mermaid
flowchart TD
    subgraph Fontes["Fontes públicas gratuitas"]
        CONAB["CONAB<br/>boi · soja · milho"]
        CAMBIO["BCB · Frankfurter · gold-api<br/>dólar · euro · ouro"]
        METEO["Open-Meteo<br/>chuva"]
    end

    subgraph Coleta["Coleta agendada"]
        CRON["Vercel Cron 1×/dia"] -->|Bearer CRON_SECRET| COLETAR["GET /api/coletar"]
        CONAB --> COLETAR
        CAMBIO --> COLETAR
    end

    subgraph Reportes["Termômetro da Praça"]
        PROD["Produtor"] -->|preço anônimo| REPORTAR["POST /api/reportar<br/>honeypot · faixa · rate-limit"]
        MOD["Moderador"] -->|senha + cookie HMAC| DECIDIR["POST /api/moderar/decidir"]
    end

    COLETAR -->|service role| DB[("Supabase / PostgreSQL<br/>RLS: leitura pública<br/>escrita só service role")]
    REPORTAR -->|service role| DB
    DECIDIR -->|service role| DB

    DB -->|anon key| PAGES["Páginas Next.js<br/>painel · gráficos · boletim · termômetro"]
    METEO -->|ISR/dynamic| PAGES
```

**Princípio de design:** cada fonte de cotação é desacoplada da orquestração (`lib/fontes/*` ↔ `lib/coleta.ts` via a porta `CotacaoRepo`), então adicionar uma cotação é registrar uma função — sem tocar no resto. A lógica de negócio (mediana, faixa, agregação, validação, sessão de moderação) vive em módulos **puros e testados** em `lib/`, separada da apresentação.

---

## Como foi construído

Cada funcionalidade é uma **fatia vertical fina** que percorre o ciclo completo antes da próxima começar: `brainstorming → spec → plano → implementação (TDD) → review → deploy verificado`.

```mermaid
timeline
    title Fatias entregues e no ar
    Fatias 1–3 : Painel + dólar (AwesomeAPI→BCB) : Gráfico 7/30/90d + backfill : Euro e ouro + registry de fontes
    Fatia 4 : Commodities CONAB (boi, soja, milho)
    Fatia 5 : Boletim diário em PNG
    Fatia 6 : Previsão de chuva
    Fatia 7 : Redesign visual (identidade própria)
    Fatias 8–9 : Termômetro T1 (reporte + RLS) : Termômetro T2 (moderação pelo celular)
    Fatias 10–11 : Mediana + faixa (robustez) : Histórico do Termômetro
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front + back | Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4 |
| Tipografia | Playfair Display · Archivo · JetBrains Mono (via `next/font`) |
| Banco / Auth | Supabase (PostgreSQL + Row Level Security) |
| Gráficos | Sparklines em SVG puro · Recharts (detalhe) |
| Imagem do boletim / OG | `next/og` (Satori) — PNG gerado no servidor |
| Geolocalização | Vercel Edge Geo (IP) + Open-Meteo (temperatura) |
| Coleta / envio agendados | Route Handlers + Vercel Cron (coleta · boletim · alertas) |
| Bot | Telegram Bot API (inscrição, boletim, alertas) |
| Testes | Vitest + Testing Library (281 testes) |
| Deploy | Vercel (auto-deploy no push, ISR, cron) |

---

## Estrutura

```
agro_app/
├─ app/
│  ├─ page.tsx                     # Painel (Na porteira / Mercado)
│  ├─ cotacao/[tipo]/page.tsx      # Detalhe + gráfico de tendência
│  ├─ boletim/page.tsx             # Card do dia + download
│  ├─ chuva/page.tsx               # Previsão de 7 dias
│  ├─ termometro/
│  │  ├─ page.tsx                  # Valor típico (mediana) por produto
│  │  ├─ reportar/page.tsx         # Reporte anônimo
│  │  └─ [produto]/page.tsx        # Histórico (gráfico) do produto
│  ├─ moderar/page.tsx             # Moderação protegida por senha
│  └─ api/
│     ├─ coletar · backfill        # Coleta/backfill (Cron/segredo)
│     ├─ boletim                   # PNG 1080×1080
│     ├─ reportar                  # Recebe reporte anônimo
│     └─ moderar/{login,decidir}   # Sessão + decisão da moderação
├─ lib/
│  ├─ fontes/*                     # Uma fonte por arquivo + registry
│  ├─ coleta.ts · backfill.ts      # Orquestração pura
│  ├─ termometro.ts                # Produtos, validação, mediana, faixa
│  ├─ termometro-historico.ts      # Mediana diária para o gráfico
│  ├─ moderacao.ts                 # Token HMAC, sessão, validação
│  ├─ boletim.ts · grafico.ts      # View-models puros
│  └─ supabase/{server,public,repo}.ts
├─ components/                     # Apresentação (cards, gráficos, formulários)
├─ supabase/migrations/            # DDL + RLS versionado
├─ components/redesign/            # Sistema visual novo (masthead, cards, ticker…)
├─ tests/                          # 281 testes unitários e de componente
├─ vercel.json                     # Cron diário → /api/coletar
└─ docs/superpowers/{specs,plans}/ # Spec e plano de cada fatia
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

Crie um projeto e aplique as migrations de [`supabase/migrations/`](supabase/migrations/) em ordem (SQL Editor do Supabase Studio, ou `supabase db push` com o projeto vinculado):

- `0001_cotacoes.sql` — tabelas `cotacoes` e `cotacoes_historico` + RLS
- `0002_*` — constraint única `(tipo, data_referencia)`
- `0003_reportes.sql` — tabela `reportes` do Termômetro + RLS

### 4. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=...            # service role — NUNCA expor no client
CRON_SECRET=...                          # segredo forte para a coleta agendada
MODERACAO_SENHA=...                      # senha da moderação em /moderar
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` e `MODERACAO_SENHA` são usadas **apenas no servidor**. Nunca as coloque numa variável `NEXT_PUBLIC_*`.

### 5. Rodar

```bash
npm run dev          # http://localhost:3000
```

A primeira coleta popula o painel (a tela começa vazia):

```bash
curl -H "authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/coletar
```

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

1. Conecte o repositório à Vercel — cada `git push` na `master` dispara o deploy.
2. Defina as 5 variáveis de ambiente (as mesmas do `.env.local`) no projeto, marcadas para **Production**.
3. O agendamento em [`vercel.json`](vercel.json) chama `/api/coletar` 1×/dia; a Vercel injeta `Authorization: Bearer ${CRON_SECRET}` automaticamente.

---

## Modelo de dados

```sql
cotacoes              -- último valor "vivo" por tipo (1 linha por tipo)
  tipo, valor, unidade, variacao_pct, fonte, data_referencia, atualizado_em

cotacoes_historico    -- série temporal append-only (alimenta os gráficos)
  tipo, valor, fonte, data_referencia, created_at

reportes              -- Termômetro da Praça: preços reportados, moderados
  produto, municipio, valor, status (pendente/aprovado/rejeitado), ip_hash, criado_em
```

**RLS desde o início:** `SELECT` público (em `reportes`, só linhas `aprovado`); `INSERT/UPDATE/DELETE` revogados de `anon`/`authenticated` — toda escrita passa pelo service role no servidor.

---

## Roadmap

- [x] Painel de cotações + coleta diária do dólar
- [x] Gráfico de tendência (toggle 7/30/90) + backfill
- [x] Euro e ouro — coleta/backfill multi-fonte resiliente
- [x] Commodities via CONAB: boi gordo, soja, milho
- [x] Boletim diário em card PNG (Satori)
- [x] Previsão de chuva por município
- [x] Redesign com identidade visual própria
- [x] Termômetro da Praça: reporte anônimo + moderação pelo celular
- [x] Mediana + faixa (robustez) e histórico do Termômetro
- [x] Calculadora do produtor (lote de boi + colheita)
- [x] Bot de Telegram: inscrição, boletim diário e alertas de movimento (gratuito)
- [x] Vitrine de fornecedores com submissão pública + moderação
- [x] Redesign "fazenda moderna premium" + geolocalização do usuário
- [ ] Verificação do produtor (OTP) e reputação — *dependem de provedor pago; em avaliação*

Cada fatia segue o ciclo spec → plano → implementação, documentado em [`docs/superpowers/`](docs/superpowers/).

---

## Licença

Projeto privado. Todos os direitos reservados.
