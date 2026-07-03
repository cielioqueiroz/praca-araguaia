# Previsão de Chuva por Município — Design

> Design doc — 2026-07-03 — Fatia 6 da Praça Araguaia.
> Página `/chuva` com a previsão de 7 dias (chuva, probabilidade, temperaturas) para 5 municípios da região do Araguaia, via Open-Meteo (grátis, sem chave). Sem banco, sem cron.

## 1. Contexto e decisões

Chuva decide plantio, colheita e manejo — é informação diária de valor direto pro produtor. A Open-Meteo é gratuita, sem chave, aceita **várias coordenadas numa única chamada** e funciona de datacenter (validado em 2026-07-03).

**Decisões (validadas com o usuário):**
- **Municípios (lista fixa, coordenadas validadas no geocoding da Open-Meteo):**

| Município | UF | lat | lon |
|---|---|---|---|
| Redenção | PA | -8.02861 | -50.03139 |
| Santana do Araguaia | PA | -9.335 | -50.35 |
| Vila Rica | MT | -10.01167 | -51.11639 |
| Confresa | MT | -10.64389 | -51.56889 |
| São Félix do Araguaia | MT | -11.61722 | -50.66944 |

- **Abordagem:** página server-side **sem banco** — previsão é dado efêmero; buscar na hora com cache de 1h do Next (`next: { revalidate: 3600 }` no fetch). Descartados: coleta via cron + Supabase (complexidade sem valor) e fetch no navegador (perde cache compartilhado e SSR).
- **Dados por município:** próximos **7 dias** — dia da semana, chuva (mm), probabilidade máxima (%), temperatura mín/máx (°C). Fuso `America/Araguaina`.
- **Fora de escopo:** busca/seleção de municípios pelo usuário, histórico de chuva, alertas, radar/mapa.

### A API (validada por chamada real em 2026-07-03)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=-8.02861,-9.335,...&longitude=-50.03139,-50.35,...
  &daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min
  &timezone=America/Araguaina&forecast_days=7
```

- Resposta: **array** de objetos (um por coordenada, **na mesma ordem do request** — a resposta não traz nome; o mapeamento de volta é por índice da lista `MUNICIPIOS`).
- Cada objeto: `daily.time[7]` (yyyy-mm-dd), `daily.precipitation_sum[7]` (mm), `daily.precipitation_probability_max[7]` (%), `daily.temperature_2m_min/max[7]` (°C). `precipitation_probability_max` pode vir `null` em dias distantes — tratar como ausente.

## 2. Arquitetura

```
lib/fontes/chuva.ts           fonte pura e testável (padrão das outras fontes)
  MUNICIPIOS                  lista fixa { nome, uf, lat, lon } (tabela acima)
  buscarPrevisao(fetchImpl?)  → Promise<PrevisaoMunicipio[]>
    PrevisaoMunicipio = { municipio, uf, dias: DiaPrevisao[] }
    DiaPrevisao = { data (yyyy-mm-dd), chuvaMm, probMax (number | null), tempMin, tempMax }
    - 1 chamada só (coordenadas em lista); fetch com next: { revalidate: 3600 }
    - valida: HTTP ok, array com MUNICIPIOS.length itens, arrays diários presentes;
      resposta malformada → lança erro claro

app/chuva/page.tsx            Server Component (usa o cache do fetch, sem force-dynamic)
  título "Previsão de chuva" + subtítulo; grid de CardChuva por município
  buscarPrevisao falhou → mensagem "Previsão indisponível no momento. Tente mais tarde."
  link "← Voltar"; rodapé discreto "fonte: Open-Meteo"

components/CardChuva.tsx      card puro (recebe PrevisaoMunicipio via props)
  cabeçalho "Município · UF"; 7 linhas: dia da semana (seg, ter...), chuva mm,
  probabilidade %, temp mín–máx; dia com chuvaMm >= 10 destacado (texto em azul/negrito)

app/page.tsx                  link "Previsão de chuva →" ao lado do "Boletim do dia →"
```

- Nenhuma migração, env var, cron ou dependência nova.
- A página **não** usa `dynamic = 'force-dynamic'`: o cache de 1h do fetch é o comportamento desejado (ISR-like).

## 3. Erros e casos de borda

| Cenário | Comportamento |
|---|---|
| Open-Meteo fora do ar / HTTP non-ok | `buscarPrevisao` lança; a página captura e mostra "Previsão indisponível no momento". |
| Resposta com menos itens que municípios | Lança (malformada) → mensagem de indisponível. |
| `precipitation_probability_max` null | Exibe "—" na probabilidade daquele dia. |
| Dia sem chuva (0 mm) | Exibe "0 mm" normal, sem destaque. |
| Chuva forte (>= 10 mm) | Linha destacada (azul/negrito). |

## 4. Testes (TDD)

- `buscarPrevisao` (fixture com o formato real: array de 5, daily arrays de 7):
  monta os 5 municípios na ordem e com nomes/UF corretos; mapeia os campos do dia;
  probabilidade null preservada; HTTP non-ok → lança; array com tamanho errado → lança;
  daily ausente → lança.
- `CardChuva`: renderiza nome/UF, 7 linhas, "—" para probabilidade null, destaque quando chuvaMm >= 10 (e ausência de destaque abaixo).
- Página fora dos testes unitários (padrão do projeto) — verificação via build + smoke manual.

## 5. Critérios de sucesso

1. `/chuva` mostra 5 cards (Redenção, Santana do Araguaia, Vila Rica, Confresa, São Félix do Araguaia) com 7 dias cada: dia, mm, %, mín–máx.
2. Painel tem o link "Previsão de chuva →".
3. Open-Meteo indisponível → página amigável, sem 500.
4. Uma única chamada HTTP à Open-Meteo por render (cache de 1h entre renders).
5. Testes passam; build/lint limpos; deploy na Vercel com a página no ar.
