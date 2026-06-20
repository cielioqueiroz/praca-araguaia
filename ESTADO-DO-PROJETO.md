# Estado do Projeto — agro_app (Praça Araguaia)

> **Documento de retomada.** Última atualização: 2026-06-19.
> Quando voltar, comece por aqui. Tudo está commitado e no ar.

---

## Resumo

Plataforma de **cotações agropecuárias** para a região do Araguaia. App Next.js 15 que coleta cotações de fontes públicas, guarda histórico no Supabase e mostra painel + gráficos. Construído em fatias verticais finas (spec → plano → implementação → deploy).

- **Produção:** https://agroapp-bay.vercel.app
- **Repositório (privado):** https://github.com/cielioqueiroz/praca-araguaia
- **Branch:** `master` (tudo já commitado e pushado)

---

## Infra (já configurada)

| Recurso | Detalhe |
|---|---|
| **Supabase** | Projeto `praca-araguaia`, ref `eoguwsybosgzfeiqqxjk`, região `sa-east-1`. Tabelas `cotacoes` e `cotacoes_historico` com RLS (leitura pública, escrita só service role) + constraint única `(tipo, data_referencia)`. |
| **Vercel** | Projeto `cielio-queiroz/agro_app`, repo do GitHub conectado → **todo `git push` na `master` faz deploy automático** (não precisa de token para deployar). |
| **Cron** | `vercel.json`: `GET /api/coletar` 1×/dia às 11:00 UTC (08:00 BRT). A Vercel injeta `Authorization: Bearer ${CRON_SECRET}` automaticamente. |
| **Env vars** | Em `.env.local` (local, fora do git) e nas Environment Variables da Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. |

> O token da Vercel criado naquele dia (`agro-deploy`) tinha validade de 1 dia — provavelmente já expirou. **Não é problema:** para deployar basta `git push` (auto-deploy). Só precisaria de token novo se for usar o `vercel` CLI direto.

---

## O que já está pronto

### Fatia 1 — Painel + coleta do dólar
- Painel `/` lê `cotacoes` (anon) e mostra cards.
- `GET /api/coletar` (protegida por `CRON_SECRET`) coleta e grava (`cotacoes` upsert + `cotacoes_historico`).
- Dólar: **AwesomeAPI** (tempo real) com **fallback para o BCB** (a AwesomeAPI dá **429 em IP de datacenter da Vercel**, por isso o fallback é essencial).
- Stack: Next.js 15 (App Router), TypeScript strict, Supabase, Vitest.

### Fatia 2 — Gráfico de tendência
- Página `/cotacao/[tipo]` (Server Component): card atual + gráfico (shadcn/ui Chart sobre Recharts) com **toggle 7/30/90 dias**.
- `GET /api/backfill` popula o histórico (idempotente, `on conflict do nothing`).
- **Migração para Tailwind v4** (o shadcn 4.x exige v4).
- Dólar: backfill ~90 dias via **BCB intervalo de datas** (o endpoint `ultimos/N` do BCB dá 400 com N grande).

### Fatia 3 — Euro, Ouro e branding
- **Euro** (Frankfurter/BCE) e **Ouro** (gold-api em USD × USD-BRL do Frankfurter) — fontes confiáveis a partir da Vercel.
- **Registry de fontes** (`lib/fontes/registry.ts`): adicionar cotação = registrar uma função.
- **Coleta e backfill multi-fonte e resilientes**: falha de uma fonte não derruba as outras.
- Backfill do euro (~63 dias); ouro acumula a partir de agora.
- Nome visível **agro_app** (aba + título) e **favicon** (`app/icon.svg`).
- Coleta diária virou idempotente no histórico (upsert), evitando conflito com o backfill.

**Estado atual:** 63 testes passando, build/lint limpos, 3 cotações no ar (dólar, euro, ouro).

---

## Como rodar / continuar (local)

```bash
npm install
cp .env.local.example .env.local   # preencher com as chaves do Supabase + CRON_SECRET
npm run dev                          # http://localhost:3000
npm test                             # 63 testes
npm run build                        # build de producao
npm run lint                         # ESLint (o que a Vercel roda)
```

Disparar coleta/backfill manualmente (local ou prod):
```bash
curl -H "authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/coletar
curl -H "authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/backfill
```

**Deploy:** `git push origin master` → a Vercel faz o resto.

---

## Estrutura (mapa rápido)

```
app/
  page.tsx                 # painel
  cotacao/[tipo]/page.tsx  # detalhe + grafico
  api/coletar/route.ts     # coleta diaria (itera FONTES)
  api/backfill/route.ts    # backfill historico (itera FONTES_HISTORICO)
  icon.svg                 # favicon
lib/
  fontes/{dolar,euro,ouro}.ts   # uma fonte por arquivo
  fontes/registry.ts            # FONTES + FONTES_HISTORICO
  coleta.ts                     # orquestracao (fonte -> repo)
  backfill.ts                   # orquestracao do backfill
  grafico.ts                    # filtrarPorPeriodo (puro)
  supabase/{server,public,repo}.ts
components/{CardCotacao,GraficoCotacao}.tsx + ui/ (shadcn)
types/cotacao.ts                # Cotacao, CotacaoRepo, PontoHistorico, HistoricoRepo
supabase/migrations/            # 0001 (tabelas+RLS), 0002 (constraint unica)
docs/superpowers/{specs,plans}/ # specs e planos de cada fatia
```

---

## O que falta (próximas fatias)

Ordem sugerida — cada uma segue o ciclo `/brainstorming` → spec → plano → implementação.

1. **Commodities: boi gordo, soja, milho** — o dado mais importante pro produtor. **Bloqueio:** definir a fonte (B3 não tem API pública simples; CEPEA tem direitos sobre os indicadores; IMEA é regional de MT). Começa com uma fase de pesquisa/decisão de fonte. *Provável próximo passo de maior valor.*
2. **Termômetro da Praça** — o diferencial/fosso: reporte anônimo de preço local + moderação + média semanal. Mais complexo (auth por telefone/WhatsApp, moderação, novas tabelas).
3. **Boletim diário em card** (Satori / `@vercel/og`) para postar no Instagram/WhatsApp.
4. **Previsão de chuva** por município (Open-Meteo, grátis).
5. **Vitrine de insumos/fornecedores** + **alertas no WhatsApp** (fases posteriores do conceito).

### Dívidas técnicas pequenas (anotadas nas reviews)
- Backfill de **ouro** (sem fonte histórica grátis definida ainda).
- Tipos gerados do Supabase (`supabase gen types`) para tipar as queries.
- `salvar` não é transacional (upsert em `cotacoes` + histórico em 2 chamadas) — risco baixo numa coleta diária.

---

## Ponto de retomada

Quando voltar: o app está **100% funcional e no ar com dólar, euro e ouro**. O próximo passo de maior valor é decidir a **fonte de dados das commodities (boi/soja/milho)** e abrir a Fatia 4 — ou, se preferir o diferencial estratégico, o **Termômetro da Praça**. É só dizer qual e eu inicio pelo `/brainstorming`.
