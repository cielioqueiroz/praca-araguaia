# Estado do Projeto — agro_app (Praça Araguaia)

> **Documento de retomada.** Última atualização: 2026-07-03.
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

### Fatia 4 — Commodities CONAB (boi gordo, soja, milho)
- **Fonte:** arquivo público semanal da CONAB (`PrecosSemanalUF.txt`, ~14,5 MB, ISO-8859-1) — `lib/fontes/conab.ts` baixa 1×/coleta (memoização), parseia e devolve a **média de MT/PA/TO/GO** da semana mais recente.
- Unidades de mercado: boi **R$/@** (×15), soja/milho **R$/sc 60kg** (×60). Cards com legenda "média MT/PA/TO/GO · CONAB".
- Backfill de ~51 semanas por commodity com o mesmo parser; painel com ordem fixa (commodities primeiro) via `lib/tipos-ui.ts`.
- Selo "desatualizado" agora é **por tipo**: 48h (diárias) / 10 dias (semanais).
- **Fix de integração** achado no review final: variação % passou a ser calculada contra o último valor com `data_referencia` **anterior** (`ultimoValor(tipo, antesDe)`) — sem isso, a recoleta diária do mesmo ponto semanal zerava o %. `maxDuration = 60` nas rotas de coleta/backfill.

### Fatia 5 — Boletim diário em card
- `GET /api/boletim` (pública) gera PNG 1080×1080 via `next/og` (Satori) com as 6 cotações, marca Praça Araguaia, data por extenso e rodapé de fontes; cache CDN de 1h (`s-maxage=3600` + SWR 24h).
- `/boletim` mostra o card com botão "Baixar imagem"; painel ganhou o link "Boletim do dia →".
- View-model puro em `lib/boletim.ts` (ordem do painel, formatação pt-BR, variação ▲/▼, fuso America/Araguaina).
- Lição do review final: a fonte default do Satori (Noto Sans latin) **não tem os glifos ▲/▼** — as setas do card são triângulos SVG inline.

### Fatia 6 — Previsão de chuva
- `/chuva`: 7 dias (chuva mm, probabilidade, temp mín–máx) para Redenção/PA, Santana do Araguaia/PA, Vila Rica/MT, Confresa/MT e São Félix do Araguaia/MT; dias com chuva ≥ 10 mm destacados.
- Open-Meteo (grátis, sem chave), 1 chamada multi-coordenada, página estática com ISR de 1h (`next: { revalidate: 3600 }`); sem banco/cron. Falha da API → mensagem amigável (validado com a API fora do ar de verdade).
- `lib/fontes/chuva.ts` (fonte pura) + `components/CardChuva.tsx`.

**Estado atual:** 101 testes passando, build/lint limpos, 6 cotações + boletim diário + previsão de chuva.

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

1. **Termômetro da Praça** — o diferencial/fosso: reporte anônimo de preço local + moderação + média semanal. Mais complexo (auth por telefone/WhatsApp, moderação, novas tabelas). *Próxima fatia de maior valor.*
2. **Vitrine de insumos/fornecedores** + **alertas no WhatsApp** (fases posteriores do conceito).

### Dívidas técnicas pequenas (anotadas nas reviews)
- Chuva: `AbortSignal.timeout` no fetch da Open-Meteo; `console.error` no catch da página (hoje a falha não deixa rastro nos logs); reter o último dado bom na revalidação (hoje um blip da API troca dados bons por "indisponível" por até 1h); validar temperaturas por elemento (`Number(null)` vira 0 silencioso); card com grid de colunas fixas.
- Formatação de valor/variação duplicada entre `lib/boletim.ts` e `components/CardCotacao.tsx` — consolidar num helper (`lib/formatacao.ts`) numa fatia futura.
- Recorte **municipal** da CONAB (`PrecosSemanalMunicipio.txt`) para aproximar da "Praça Araguaia" de verdade.
- Backfill de **ouro** (sem fonte histórica grátis definida ainda).
- Tipos gerados do Supabase (`supabase gen types`) para tipar as queries.
- `salvar` não é transacional (upsert em `cotacoes` + histórico em 2 chamadas) — risco baixo numa coleta diária.

---

## Ponto de retomada

Quando voltar: o app está **100% funcional com 6 cotações (boi, soja, milho via CONAB; dólar, euro, ouro), boletim diário em `/boletim` e previsão de chuva em `/chuva`**. O próximo passo de maior valor é o **Termômetro da Praça** (o diferencial estratégico — merece decomposição em sub-fatias no brainstorming). É só dizer e eu inicio pelo `/brainstorming`.

Specs/planos recentes em `docs/superpowers/`: fatia 4 (`2026-07-02-commodities-conab-*`), fatia 5 (`2026-07-03-boletim-diario-card-*`) e fatia 6 (`2026-07-03-previsao-chuva-*`).
