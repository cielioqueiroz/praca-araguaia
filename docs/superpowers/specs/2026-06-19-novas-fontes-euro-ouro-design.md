# Novas Fontes: Euro e Ouro — Design

> Design doc — 2026-06-19 — Fatia 3 da Praça Araguaia.
> Adiciona euro e ouro ao painel, generalizando a coleta e o backfill para múltiplas fontes. Cada cotação ganha de graça sua página de detalhe com gráfico (já genérica em `/cotacao/[tipo]`).

## 1. Contexto e decisões

A fatia 1 entregou a coleta do dólar; a fatia 2 o gráfico. A arquitetura já é desacoplada (`fontes/*` ↔ `coleta` via `CotacaoRepo`), mas a coleta e o backfill ainda são específicos do dólar. Esta fatia generaliza para um **registry de fontes** e adiciona euro e ouro.

**Restrição crítica de produção:** a AwesomeAPI retorna **429 nos IPs da Vercel** (por isso o dólar cai pro BCB). Logo, euro e ouro **não podem depender da AwesomeAPI**. Fontes escolhidas, keyless e acessíveis de datacenter (validadas):

| Cotação | Fonte atual | Histórico | Observação |
|---|---|---|---|
| Dólar | AwesomeAPI → BCB (existente) | BCB SGS 1 (existente) | sem mudança |
| Euro | **frankfurter.dev** (BCE) `latest?base=EUR&symbols=BRL` | frankfurter time-series | confiável de datacenter |
| Ouro | **gold-api.com** `price/XAU` (USD) × **frankfurter** USD→BRL | — (forward only) | sem fonte histórica grátis simples |

**Decisões:** euro+ouro; render/painel reusa o que existe; backfill de 90 dias para euro (frankfurter); ouro acumula a partir de agora (sem backfill).

**Fora de escopo:** boi/soja/milho (fonte a definir, spec própria), backfill de ouro.

## 2. Arquitetura

```
REGISTRY  lib/fontes/registry.ts
  FONTES            = { dolar: buscarDolar, euro: buscarEuro, ouro: buscarOuro }
  FONTES_HISTORICO  = [ {dolar, bcb, buscarHistoricoDolarBcb}, {euro, frankfurter, buscarHistoricoEuroFrankfurter} ]

COLETA DIÁRIA  GET /api/coletar (cron)
  itera FONTES → coletarCotacao(fonte, repo) por tipo, cada um isolado (falha de um não derruba os outros)
  → { coletadas:[...], erros:[...] }   (502 só se TODAS falharem)

BACKFILL  GET /api/backfill
  itera FONTES_HISTORICO → backfillHistorico(tipo, fonte, buscar, repo), isolado por fonte

PAINEL / e /cotacao/[tipo]  já genéricos; só adicionar títulos euro/ouro
```

## 3. Componentes e arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/fontes/euro.ts` | Criar | `buscarEuro`, `buscarHistoricoEuroFrankfurter(dias)` |
| `lib/fontes/ouro.ts` | Criar | `buscarOuro` (gold-api × USD-BRL) |
| `lib/fontes/registry.ts` | Criar | `FONTES`, `FONTES_HISTORICO` |
| `lib/supabase/repo.ts` | Modificar | `salvarHistoricoEmLote(tipo, fonte, pontos)` (generaliza) |
| `lib/backfill.ts` | Modificar | `backfillHistorico(tipo, fonte, buscar, repo)` |
| `app/api/coletar/route.ts` | Modificar | itera `FONTES`, resiliente |
| `app/api/backfill/route.ts` | Modificar | itera `FONTES_HISTORICO`, resiliente |
| `app/page.tsx`, `app/cotacao/[tipo]/page.tsx` | Modificar | `TITULOS` += euro, ouro |
| `types/cotacao.ts` | Modificar | `HistoricoRepo.salvarHistoricoEmLote` nova assinatura |

### Contratos
- `buscarEuro(fetch?) → Cotacao` (tipo `euro`, unidade `R$`, fonte `frankfurter`). frankfurter: `{ date, rates:{BRL} }`. Valida `BRL>0`, `date`.
- `buscarHistoricoEuroFrankfurter(dias=90, fetch?) → PontoHistorico[]` (asc). frankfurter série: `{ rates: { "yyyy-mm-dd": {BRL} } }`.
- `buscarOuro(fetch?) → Cotacao` (tipo `ouro`, unidade `R$`, fonte `gold-api`). `price` (USD) × USD-BRL (frankfurter), arredondado a 2 casas. dataReferencia = `updatedAt` (ou agora). Valida `price>0` e `usdBrl>0`.
- Datas sem hora → 00:00 BRT (`-03:00`) → ISO, como nas outras fontes.

## 4. Erros e casos de borda

| Cenário | Comportamento |
|---|---|
| Uma fonte falha na coleta diária | Loga, registra em `erros[]`, **não** bloqueia as outras; 200 com o que coletou. |
| Todas as fontes falham | 502. |
| Fonte sem `ok`/JSON inválido | A fonte valida e lança; entra em `erros[]`. |
| Rota sem `CRON_SECRET` | 401. |
| Ouro: USD-BRL indisponível | Lança (não grava ouro com conversão inválida). |
| `/cotacao/[tipo]` de tipo sem dados | Estado vazio (já tratado). |

## 5. Testes (TDD)

- `buscarEuro` / `buscarHistoricoEuroFrankfurter`: parse válido → Cotacao/pontos; HTTP non-ok → erro; valor ≤ 0 → erro; série vazia → erro.
- `buscarOuro`: price×usdBrl correto e arredondado; price ≤ 0 → erro; usdBrl ≤ 0 → erro; gold-api/frankfurter non-ok → erro.
- `repo.salvarHistoricoEmLote(tipo, fonte, pontos)`: grava com tipo/fonte certos; vazio → não chama banco; erro lança.
- `backfillHistorico(tipo, fonte, buscar, repo)`: grava e retorna `{tipo, pontos}`; fonte falha → não grava; erro propaga.
- `/api/coletar`: 401; 200 com `coletadas` (mock FONTES + coletarCotacao); 502 se todas falham; falha de uma não derruba as outras.
- `/api/backfill`: 401; 200 com `resultados`; 502 se todas falham.

## 6. Critérios de sucesso

1. Painel mostra dólar, euro e ouro (cards clicáveis).
2. `/cotacao/euro` e `/cotacao/ouro` abrem com card + gráfico.
3. Coleta diária coleta as 3 fontes; falha isolada não derruba o cron.
4. Backfill popula histórico do euro (~90d) de forma idempotente; dólar mantém o seu.
5. Testes passam; build/lint limpos.
6. Deploy na Vercel com euro e ouro funcionando no ar.
