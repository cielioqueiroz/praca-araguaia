# Commodities CONAB: Boi Gordo, Soja e Milho — Design

> Design doc — 2026-07-02 — Fatia 4 da Praça Araguaia.
> Adiciona ao painel as três cotações mais importantes para o produtor da região — boi gordo, soja e milho — usando dados públicos semanais da CONAB, com média das UFs da região do Araguaia (MT, PA, TO, GO).

## 1. Contexto e decisões

O bloqueio desta fatia era a fonte de dados. Pesquisa feita em 2026-07-02:

| Fonte | Situação | Veredito |
|---|---|---|
| **CONAB** (Preços Agropecuários) | Arquivo público `PrecosSemanalUF.txt`, sem autenticação, atualizado diariamente ~11h UTC. Tem BOI/GORDO, SOJA/EM GRÃOS, MILHO/EM GRÃOS com nível "PREÇO RECEBIDO P/ PR", semanal por UF, cobrindo MT/PA/TO/GO, histórico ~18 meses. | **Escolhida** |
| CEPEA/ESALQ | Indicadores de referência, mas com direitos autorais — republicação exige autorização. | Descartada |
| B3 | Sem API pública simples para o físico. | Descartada |
| Agrolink | API comercial paga. | Descartada |
| agrobr | Biblioteca Python (não utilizável do Next.js); confirma CEPEA/CONAB como fontes primárias. | Descartada |

**Decisões (validadas com o usuário):**
- **Recorte:** média das UFs **MT, PA, TO e GO** (região do Araguaia). É uma média nossa, não um indicador oficial — o UI deixa isso explícito ("média MT/PA/TO/GO · CONAB").
- **Abordagem:** fonte única `lib/fontes/conab.ts` plugada no registry existente e no cron diário atual (Abordagem A). Sem infra nova.
- **Unidades (convenção de mercado):** boi em **R$/@** (R$/kg × 15); soja e milho em **R$/sc 60kg** (R$/kg × 60). Arredondado a 2 casas.
- **Fora de escopo:** recorte municipal (evolução futura), outras commodities do arquivo (café, arroz...), backfill de ouro.

### O arquivo da CONAB (validado por download em 2026-07-02)

- URL: `https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosSemanalUF.txt`
- ~14,5 MB, ~96 mil linhas, **ISO-8859-1**, CSV separado por `;`, com header.
- Colunas: `produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg`
- Campos com padding de espaços (fazer `trim`); decimal com vírgula (`22,48`).
- Semana no formato `"dd-mm-aaaa - dd-mm-aaaa"`; linhas **não ordenadas** por data.
- Filtro alvo: `(BOI, GORDO)`, `(SOJA, EM GRÃOS)`, `(MILHO, EM GRÃOS)` com nível `PREÇO RECEBIDO P/ PR` e UF ∈ {MT, PA, TO, GO}. Atenção: nível vem truncado no arquivo (`PREÇO RECEBIDO P/ PR`); comparar por prefixo. Existem também níveis `ATACADO` (ignorar) e `MILHO DE PIPOCA` (ignorar via classificação).

## 2. Arquitetura

```
lib/fontes/conab.ts
  carregarConab()            baixa + parseia o txt 1x (memoizado ~10min, resetável em teste)
  buscarBoi/Soja/Milho()     → Cotacao (média da semana mais recente, unidade convertida)
  buscarHistoricoConab(tipo) → PontoHistorico[] (1 ponto por semana, média das UFs, asc)

REGISTRY  lib/fontes/registry.ts
  FONTES            += { boi, soja, milho }
  FONTES_HISTORICO  += [ {boi, conab}, {soja, conab}, {milho, conab} ]

COLETA/BACKFILL  já genéricos e resilientes — nenhuma mudança nas rotas
PAINEL           ordem fixa dos cards + títulos + legenda + desatualizado por tipo
```

A memoização garante **1 download do arquivo por coleta** mesmo com 3 tipos no registry (em serverless o módulo vive por instância; TTL curto evita dado velho). Falha da CONAB entra em `erros[]` sem derrubar dólar/euro/ouro (comportamento existente).

## 3. Componentes e arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/fontes/conab.ts` | Criar | download + parse + memoização; `buscarBoi/Soja/Milho`, `buscarHistoricoConab` |
| `lib/fontes/registry.ts` | Modificar | += 3 entradas em `FONTES` e 3 em `FONTES_HISTORICO` |
| `lib/tipos-ui.ts` | Criar | `TITULOS` (hoje duplicado nas 2 páginas), `ORDEM_PAINEL`, `LEGENDAS`, `prazoDesatualizadoMs(tipo)` |
| `app/page.tsx` | Modificar | usa `lib/tipos-ui`; ordena cards (boi, soja, milho, dólar, euro, ouro); legenda; prazo por tipo |
| `app/cotacao/[tipo]/page.tsx` | Modificar | usa `lib/tipos-ui`; legenda; prazo por tipo |
| `components/CardCotacao.tsx` | Modificar | novo prop opcional `legenda?: string` (linha discreta sob o título) |

### Contratos

- `buscarBoi/Soja/Milho(fetch?) → Cotacao`:
  - `tipo`: `boi` | `soja` | `milho`; `fonte`: `conab`; `unidade`: `R$/@` | `R$/sc 60kg`.
  - `valor`: média aritmética das UFs disponíveis (≥1) na **semana mais recente** que tenha dado para o tipo, × 15 (boi) ou × 60 (soja/milho), 2 casas.
  - `dataReferencia`: último dia da semana pesquisada, 00:00 BRT (`-03:00`) → ISO, como as demais fontes.
- `buscarHistoricoConab(tipo, fetch?) → PontoHistorico[]`: um ponto por semana (mesma média e conversão), ordem ascendente por data.
- Parse: decodifica com `TextDecoder('iso-8859-1')`; ignora linhas malformadas ou com valor não numérico/≤ 0; `trim` em todos os campos; vírgula decimal → ponto.

## 4. Erros e casos de borda

| Cenário | Comportamento |
|---|---|
| Download da CONAB falha (HTTP non-ok, timeout) | Fonte lança; coleta registra em `erros[]` e segue com as outras. |
| Linha malformada / valor inválido | Ignorada no parse; não derruba o arquivo. |
| Semana mais recente sem nenhuma das 4 UFs para um tipo | Usa a semana anterior mais recente que tenha ≥1 UF. |
| Arquivo sem nenhuma linha do tipo após filtro | Fonte lança (dado indisponível). |
| Dado semanal "parado" no painel | Selo `desatualizado` passa a ser por tipo: 48h (dólar/euro/ouro), **10 dias** (boi/soja/milho). |
| Gráfico de 7 dias com pontos semanais | Mostra 1–2 pontos; aceitável (dado é semanal). |
| 3 tipos coletados na mesma execução | 1 download só (memoização); cada tipo ainda é salvo isoladamente. |

## 5. Testes (TDD)

Fixture pequena do txt (com header, acentos ISO-8859-1, padding, vírgula decimal, linha malformada, níveis ATACADO, semanas múltiplas e UFs parciais):

- Parse: filtra produto/classificação/nível/UF certos; ignora ATACADO, MILHO DE PIPOCA e linhas inválidas.
- `buscarBoi`: média correta das UFs da semana mais recente × 15, unidade `R$/@`, dataReferencia = fim da semana em BRT.
- `buscarSoja`/`buscarMilho`: × 60, unidade `R$/sc 60kg`.
- Semana incompleta: média só das UFs presentes; sem UF nenhuma → cai para a semana anterior.
- Nenhum dado do tipo → lança; HTTP non-ok → lança.
- Memoização: duas chamadas (`buscarBoi` + `buscarSoja`) → 1 fetch; após reset → baixa de novo.
- `buscarHistoricoConab`: 1 ponto por semana, ascendente, convertido.
- `prazoDesatualizadoMs`: 48h para câmbio/ouro, 10 dias para commodities.
- Registry: novos tipos presentes em `FONTES` e `FONTES_HISTORICO`.

## 6. Critérios de sucesso

1. Painel mostra 6 cards na ordem boi, soja, milho, dólar, euro, ouro — commodities com legenda "média MT/PA/TO/GO · CONAB".
2. `/cotacao/boi`, `/cotacao/soja` e `/cotacao/milho` abrem com card + gráfico de tendência.
3. Coleta diária grava as 3 commodities; falha da CONAB não derruba as demais fontes.
4. Backfill popula ~18 meses de histórico semanal das 3 commodities, idempotente.
5. Cards semanais não exibem "desatualizado" indevidamente (prazo de 10 dias).
6. Testes passam; build/lint limpos; deploy na Vercel com as 6 cotações no ar.
