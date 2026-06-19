# Gráfico de Tendência do Dólar — Design

> Design doc — 2026-06-19
> Segunda fatia da plataforma Praça Araguaia (ver `conceito-praca-araguaia.md` e a fatia 1 em `2026-06-19-fatia-vertical-dolar-design.md`).
> Objetivo: mostrar a evolução do dólar ao longo do tempo numa página de detalhe, alimentada por backfill do BCB + a coleta diária já existente.

---

## 1. Contexto e decisões

A fatia 1 já entrega coleta → banco → painel (dólar via AwesomeAPI com fallback BCB, gravando `cotacoes` + `cotacoes_historico`, deploy na Vercel com cron diário). Esta fatia adiciona o **gráfico de tendência** — o "gancho de retorno" citado no conceito.

**Decisões do brainstorming:**

| Decisão | Escolha | Motivo |
|---|---|---|
| Dados do gráfico | Backfill ~90 dias do BCB + acumular | Gráfico útil desde o 1º dia; sem esperar semanas |
| Render | shadcn/ui Chart (Recharts) | Hover/tooltip prontos, tematizável, base de UI reutilizável |
| Localização | Página de detalhe `/cotacao/[tipo]` | Painel limpo; escala para boi/soja (1 página por cotação) |
| Período | Toggle 7d / 30d / 90d (filtro no cliente) | Flexível e barato (backfill traz 90d) |
| Backfill | Rota protegida `/api/backfill` + constraint única | Idempotente, versionado, reusa o padrão da coleta |

**Fora de escopo (YAGNI):** backfill > 90 dias, agregação/downsampling, gráfico de outras cotações (só dólar existe), comparação entre cotações, export.

---

## 2. Arquitetura e fluxo

```
BACKFILL (1×, sob demanda)
[BCB SGS série 1 — últimos 90 dias]
        │ GET /api/backfill  (Authorization: Bearer CRON_SECRET)
        ▼
[lib/backfill: valida + grava em lote] ── on conflict (tipo, data_referencia) do nothing ──► cotacoes_historico

LEITURA (a cada visita)
/cotacao/[tipo]  (Server Component, anon key)
        │ lê cotacoes (atual) + cotacoes_historico (90d)
        ▼
[GraficoCotacao  "use client"] → shadcn Chart + toggle 7/30/90 (filtra no cliente)

NAVEGAÇÃO
/ (painel) → card do dólar vira link → /cotacao/dolar
```

- A **coleta diária** (`/api/coletar`) continua igual; passa a alimentar também o gráfico.
- **Idempotência** via migration `0002` com `unique (tipo, data_referencia)` em `cotacoes_historico`.

---

## 3. Modelo de dados

Sem tabelas novas. Migration `0002`:

```sql
alter table cotacoes_historico
  add constraint cotacoes_historico_tipo_data_unq unique (tipo, data_referencia);
```

Tipo compartilhado novo em `types/cotacao.ts`:

```ts
export type PontoHistorico = { data: string; valor: number }; // data ISO 8601, ordem asc
```

Nota de coexistência: a coleta via AwesomeAPI grava com hora real (ex.: 14:10), o backfill BCB com 00:00 BRT — timestamps distintos, não colidem no mesmo dia. No máximo 2 pontos no dia em que a coleta rodou; o gráfico lida bem.

---

## 4. Componentes e arquivos

```
agro_app/
├─ app/
│  ├─ page.tsx                      # MODIFICAR: card vira link p/ /cotacao/dolar
│  ├─ cotacao/[tipo]/page.tsx       # NOVO: detalhe (atual + gráfico), Server Component
│  └─ api/backfill/route.ts         # NOVO: rota protegida (Bearer CRON_SECRET)
├─ lib/
│  ├─ fontes/dolar.ts               # MODIFICAR: + buscarHistoricoDolarBcb(dias, fetch)
│  ├─ backfill.ts                   # NOVO: orquestra fonte→repo (idempotente)
│  ├─ grafico.ts                    # NOVO: filtrarPorPeriodo(pontos, dias) — pura
│  ├─ supabase/repo.ts              # MODIFICAR: + salvarHistoricoEmLote(); + historicoRecente()
│  └─ utils.ts                      # NOVO (shadcn): cn()
├─ components/
│  ├─ GraficoCotacao.tsx            # NOVO: "use client", shadcn Chart + toggle 7/30/90
│  └─ ui/chart.tsx                  # NOVO (shadcn): wrapper de Chart
├─ supabase/migrations/0002_historico_unique.sql   # NOVO
├─ components.json                  # NOVO (shadcn init)
└─ (globals.css / tailwind ajustados pelo shadcn init, sem quebrar o painel atual)
```

**Unidades isoladas:**

| Unidade | Faz | Depende de |
|---|---|---|
| `fontes/dolar.ts › buscarHistoricoDolarBcb(dias, fetch)` | Busca N dias do BCB, valida, devolve `PontoHistorico[]`. Não conhece banco. | `fetch` |
| `lib/backfill.ts › backfillHistorico(fonte, repo)` | Pega os pontos da fonte e grava em lote (idempotente). | fonte, repo |
| `lib/grafico.ts › filtrarPorPeriodo(pontos, dias)` | Filtra para os últimos N dias. **Pura.** | — |
| `supabase/repo.ts` | `salvarHistoricoEmLote(pontos)` (on conflict do nothing) + `historicoRecente(tipo, desde)`. | supabase-js |
| `app/cotacao/[tipo]/page.tsx` | Lê atual + histórico, monta a página. | repo/public, GraficoCotacao, CardCotacao |
| `components/GraficoCotacao.tsx` | Render do gráfico + toggle; usa `filtrarPorPeriodo`. | shadcn chart, grafico.ts |

### Fonte BCB (série histórica)
- `GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/90?formato=json`
- Resposta: `[{ "data": "21/03/2026", "valor": "5.0123" }, …]` (dias úteis, asc).
- Cada item → `PontoHistorico { data: ISO (00:00 BRT→UTC via OFFSET_BRT), valor }`, validando `valor > 0` e `data` em `dd/MM/yyyy`.

### Leitura
- `historicoRecente('dolar', desde)`: `select data_referencia, valor from cotacoes_historico where tipo=? and data_referencia >= ? order by data_referencia asc` (desde = hoje − 90d). Mapeia para `PontoHistorico`.
- A página também lê a cotação atual de `cotacoes` para o cabeçalho (reusa `CardCotacao`).

### Gráfico
- `GraficoCotacao({ pontos })`: estado `periodo` (7|30|90, default 30); aplica `filtrarPorPeriodo`.
- LineChart: X = data (curto pt-BR), Y = valor; tooltip "dd/mm — R$ x,xxxx".
- Toggle de 3 botões; só muda o estado (sem refetch). `ChartConfig` define a cor da série (verde do tema).

### shadcn (uma vez)
- `npx shadcn@latest init` (CSS vars, `lib/utils.ts`, `components.json`) + `npx shadcn@latest add chart` (traz `components/ui/chart.tsx` + dep `recharts`).
- Ajustes em `globals.css`/tailwind sem quebrar o painel existente.

---

## 5. Tratamento de erros e casos de borda

| Cenário | Comportamento |
|---|---|
| BCB fora do ar / non-ok no backfill | Falha sem gravar nada; rota retorna 502 + log. |
| Resposta do BCB malformada | `buscarHistoricoDolarBcb` valida cada item (valor > 0, data dd/MM/yyyy); item inválido → erro, não grava. |
| Backfill rodado 2× | `on conflict (tipo, data_referencia) do nothing` → sem duplicatas. |
| `/api/backfill` sem `CRON_SECRET` | 401, não executa. |
| `/cotacao/[tipo]` com tipo inexistente / sem histórico | Estado vazio explícito ("sem histórico ainda"), não tela quebrada. |
| Gráfico com poucos pontos (1–2) | Renderiza linha/pontos sem quebrar. |
| Período sem pontos (ex.: 7d num fim de semana) | Mostra estado vazio dentro do card do gráfico. |

---

## 6. Testes (TDD)

- **`buscarHistoricoDolarBcb`** (unit, fetch mockado): array válido de N dias → `PontoHistorico[]` ordenado, datas ISO corretas (00:00 BRT → 03:00Z); item com valor ≤ 0 ou data malformada → erro; HTTP non-ok → erro.
- **`backfillHistorico`** (unit, fonte+repo mockados): chama `salvarHistoricoEmLote` uma vez com todos os pontos; fonte falha → não grava; erro de escrita propaga.
- **`filtrarPorPeriodo`** (unit, pura): 90 pontos → 7d retorna só os últimos 7 dias; 30d < 90d; borda inclusiva no limite; lista vazia → vazia.
- **`repo.salvarHistoricoEmLote` / `historicoRecente`** (unit, client mockado): upsert/select corretos; erro lança.
- **`/api/backfill`** (unit, módulos mockados): sem secret → 401; sucesso → 200 (resumo, ex.: nº de pontos); erro → 502.
- **`GraficoCotacao`** (component smoke): renderiza com pontos sem erro; o toggle troca o período (verificar via `filtrarPorPeriodo`, mantendo a lógica testável fora do SVG do Recharts).
- **Smoke e2e** (`verification-before-completion`): rodar `/api/backfill` real (prod), conferir linhas no Supabase e o gráfico na página `/cotacao/dolar`.

Sem teste de RLS automatizado (a constraint e a leitura pública são validadas no painel/migration).

---

## 7. Critérios de sucesso

1. Migration `0002` aplica a constraint única no Supabase.
2. `/api/backfill` com `CRON_SECRET` popula ~90 dias do BCB de forma idempotente.
3. `/cotacao/dolar` mostra valor atual + gráfico de linha com tooltip e toggle 7/30/90.
4. O card do dólar no painel `/` linka para a página de detalhe.
5. Testes unitários passam; build limpo.
6. Deploy na Vercel com o gráfico funcionando no ar.

---

## 8. Próximas fatias (fora deste spec)

- Novas fontes (boi, soja, milho) — cada uma ganha sua página `/cotacao/[tipo]` de graça.
- Termômetro da Praça; boletim em card; alertas no WhatsApp.
