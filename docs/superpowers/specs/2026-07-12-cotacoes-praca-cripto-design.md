# Fatia 15 — Cotações honestas: ouro, cripto e preço por praça

> Spec. Data: 2026-07-12. Origem: pedido do dono (ouro errado, painel poluído, faltam criptomoedas, "não quero médias, quero os preços das respectivas cidades", card do Telegram feio e desatualizado).

## Problema

1. **Ouro está errado por um fator de 31.** `lib/fontes/ouro.ts` converte o preço da **onça troy** (gold-api, USD) para reais e o painel/card rotulam o resultado como `/g`. Hoje isso mostra `R$ 21.095,39 /g` quando a grama do ouro vale ~R$ 678 (21.095,39 ÷ 31,1034768 = 678,23 — confere com as fontes públicas de 12/07/2026, que trazem R$ 675–686).
2. **Faltam Bitcoin e Ethereum** entre as cotações de mercado.
3. **Tudo o que vem da CONAB é média** de MT/PA/TO/GO. O produtor quer o preço da *praça dele*, não uma média que não existe em lugar nenhum.
4. **Não há noção de "minha região"** no painel de cotações (só na chuva).
5. **O painel está poluído**: 6 cards grandes iguais (foto + ícone + unidade + fonte + valor + variação + sparkline + data + selo). Com cripto virariam 8.
6. **O card PNG do boletim** (entregue todo dia no Telegram por `/api/enviar-boletim`) é uma lista única de 6 linhas sem ilustração.

## Decisões tomadas (brainstorming)

- **Cidade de verdade só pelo Termômetro.** O arquivo municipal da CONAB (`PrecosSemanalMunicipio.txt`) foi reinspecionado em 12/07/2026: o último preço de **boi** por município em MT/PA/TO/GO é da semana de **26/12/2025** (~7 meses de atraso); soja para em 02/01/2026; milho só tem semanas recentes no nível "ATACADO", não "PREÇO RECEBIDO P/ PRODUTOR". Confirma a decisão da fatia 14 de descartar a fonte municipal. O que é **fresco, grátis e oficial** é o recorte **por UF**, que já baixamos e hoje jogamos fora ao tirar a média.
- **Região do usuário:** GPS do navegador (opcional) com queda para os headers de geo da Vercel — o mesmo padrão já validado em `SuaRegiaoChuva`. Sem chave, sem serviço pago.
- **Card do Telegram:** um card só, em duas colunas, com ilustração por ativo.

## Escopo

### 1. Ouro em gramas

- `lib/fontes/ouro.ts`: dividir o preço convertido por `GRAMAS_POR_ONCA_TROY = 31.1034768`; `unidade` passa de `'R$'` para `'R$/g'`.
- **Migração de dados** (`supabase/migrations/0005_ouro_em_gramas.sql`): converter os registros de ouro já gravados em `cotacoes` e `cotacoes_historico` dividindo `valor` pelo mesmo fator, e atualizar `unidade`. Sem isso, a primeira coleta nova cria um degrau falso de −96,8% no gráfico e na variação.
- A migração é idempotente por guarda de escala: só converte linhas de ouro com `valor > 5000` (a grama nunca chegou perto disso; a onça nunca ficou abaixo).

### 2. Bitcoin e Ethereum

- Nova fonte `lib/fontes/cripto.ts`: CoinGecko `/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=brl` (grátis, sem chave). `buscarBitcoin()` e `buscarEthereum()` devolvem `Cotacao` com `unidade: 'R$'` e `fonte: 'coingecko'`. Uma única resposta serve às duas (memoização curta como em `conab.ts`, para a coleta não bater duas vezes na API).
- Histórico: `buscarHistoricoCripto(moeda)` via `/api/v3/coins/{id}/market_chart?vs_currency=brl&days=90&interval=daily`, registrado em `FONTES_HISTORICO` (best-effort — falha não derruba o backfill, igual às demais).
- Registro em `FONTES` (`bitcoin`, `ethereum`), `TITULOS`, `ORDEM_PAINEL` (ao fim do grupo Mercado) e no frescor (`prazoDesatualizadoMs` → diário, 48 h).
- Formatação: BTC/ETH em `R$` com 2 casas (`R$ 617.482,10`).

### 3. Preço por praça (fim das médias)

- **Tabela nova** `cotacoes_uf` (migração `0006_cotacoes_uf.sql`): `tipo`, `uf`, `valor`, `unidade`, `variacao_pct`, `data_referencia`, único por `(tipo, uf)`. RLS igual a `cotacoes`: leitura pública, escrita só pela service role.
- `lib/fontes/conab.ts` ganha `buscarPorUf(tipo)`: do mesmo arquivo já baixado, devolve **o preço de cada UF** (MT, PA, TO, GO) na semana mais recente em que a UF tem dado, com a `variacao_pct` calculada contra a semana anterior **daquela UF** (o arquivo tem a série; não depende do banco).
- A coleta (`/api/coletar`) grava `cotacoes_uf` para boi, soja e milho, além de manter `cotacoes` (a série regional continua alimentando os gráficos de `/cotacao/[tipo]` e o histórico já acumulado).
- **Onde o usuário vê:** o painel e o card do boletim passam a mostrar a **lista por UF**, não a média. A palavra "média" sai da interface. A legenda vira `CONAB · semana dd/mm–dd/mm`.
- **Cidades:** abaixo da lista por UF, o card do boi mostra as cidades da praça com o valor típico (mediana) dos reportes aprovados dos últimos 7 dias do **Termômetro** (reusa `lib/termometro.ts`), com a contagem de reportes; cidade sem reporte aparece como "sem reporte ainda" (convite a reportar, com link para `/termometro/reportar`).

### 4. Sua praça

- `components/redesign/SuaPraca.tsx` (client): tenta `navigator.geolocation` e cai para `/api/geo` (headers da Vercel); guarda em `localStorage` (`praca-loc`, chave já usada por `LocalUsuario`).
- `lib/praca.ts` (puro): `MUNICIPIOS_PRACA` (os 5 municípios já usados na chuva, com lat/lon e UF) e `municipioMaisProximo(lat, lon)` por haversine — cálculo no navegador, nada sai do dispositivo.
- Efeito no painel: a linha da UF do usuário fica destacada na lista ("sua praça") e a cidade dele, se for uma das cinco, sobe para o topo da lista de cidades.
- Sem localização: nada quebra — a lista aparece sem destaque.

### 5. Painel menos poluído

- **Na porteira** (boi, soja, milho): cards largos de **lista** (UFs + cidades). É o conteúdo que o produtor vem ver.
- **Mercado** (dólar, euro, ouro, bitcoin, ethereum): deixa de ser 5 cards grandes e vira uma **tabela editorial compacta** — uma linha por ativo com nome, valor, variação e sparkline pequena; sem foto, sem selo, sem etiqueta de fonte por linha (a fonte vai no cabeçalho da seção).
- `CardCommodity` continua existindo para a porteira (ganha o modo lista); o grupo Mercado usa um componente novo `TabelaMercado`.

### 6. Card do boletim (Telegram)

- `/api/boletim` continua 1080×1080, agora em **duas colunas**: esquerda "Na porteira" (boi com as quatro UFs, soja, milho), direita "Mercado" (dólar, euro, ouro, bitcoin, ethereum).
- **Ilustrações:** cada linha recebe a arte do ativo. As de boi/soja/milho/dólar/euro/ouro já existem em `public/assets/cards/`; faltam `bitcoin.png` e `ethereum.png`, geradas no mesmo estilo. As imagens são lidas do disco e embutidas como **data URI** (o Satori não busca imagem externa de forma confiável no serverless).
- `lib/boletim.ts` passa a montar as duas colunas e a lista por UF do boi; o ouro sai como `R$ 678,23 /g`.
- **Nada muda no envio:** `/api/enviar-boletim` (cron 12:20 UTC) já manda o PNG desta rota via `sendPhoto` — o card novo chega no Telegram automaticamente.

## Fora de escopo (YAGNI)

- Histórico por UF (tabela `cotacoes_uf_historico`) e gráfico por praça — a variação semana a semana já vem do arquivo; gráfico continua na série regional.
- Raspagem de preços de praça em sites privados (Notícias Agrícolas/Scot): frágil e área cinzenta de termos de uso.
- Geolocalização por IP no servidor como fonte primária (erra no interior).
- Backfill histórico do ouro anterior ao que já existe.

## Arquitetura e limites

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `lib/fontes/ouro.ts` | preço da **grama** em R$ | gold-api + Frankfurter |
| `lib/fontes/cripto.ts` | BTC e ETH em R$ (atual + 90 d) | CoinGecko |
| `lib/fontes/conab.ts` | série regional **e** preço por UF | arquivo semanal da CONAB |
| `lib/praca.ts` | municípios da praça, município mais próximo (puro) | — |
| `lib/boletim.ts` | view-model do card (2 colunas, lista por UF) | `tipos-ui`, `termometro` |
| `TabelaMercado` | lista compacta de câmbio/ouro/cripto | — |
| `SuaPraca` | detectar e lembrar a praça do usuário | `lib/praca.ts`, `/api/geo` |

## Erros

- Falha de qualquer fonte não derruba a coleta (padrão já existente): cripto fora do ar → as outras 6 cotações entram normalmente.
- Sem reportes no Termômetro → a seção de cidades mostra o convite a reportar, não some.
- Sem geolocalização (negada, indisponível, fora da praça) → painel sem destaque, sem erro.
- Imagem de ativo faltando no disco → a linha do card sai sem ilustração (nunca 500 no boletim).

## Testes

- `ouro`: converte a onça em grama (valor esperado ≈ preço × câmbio ÷ 31,1034768) e devolve `unidade: 'R$/g'`.
- `cripto`: parse do `simple/price`; resposta inválida/faltando moeda → erro claro; histórico mapeia `[ms, valor]` para `PontoHistorico`.
- `conab.buscarPorUf`: uma linha por UF, valor da semana mais recente **daquela** UF, variação contra a semana anterior dela; UF sem dado é omitida, não vira zero.
- `praca.municipioMaisProximo`: escolhe o mais próximo; coordenada longe da praça → `null`.
- `boletim`: duas colunas, boi com a lista de UFs, ouro em `/g`, cripto presente.
- A suíte atual (213 testes) tem de continuar verde — em especial os testes que hoje afirmam a média da CONAB, que passam a afirmar a lista por UF onde o comportamento mudou de propósito.

## Critérios de sucesso

1. O painel e o card mostram o ouro em **R$/g** na faixa de R$ 600–800, e o gráfico do ouro não tem degrau artificial.
2. Bitcoin e Ethereum aparecem no painel, no card do Telegram e têm página de gráfico.
3. Nenhuma média aparece na interface: boi, soja e milho mostram o preço **de cada UF**, com a semana de referência; o boi mostra também as cidades da praça (Termômetro).
4. O usuário vê a praça dele destacada (quando permite/detecta a localização).
5. O card entregue no Telegram tem duas colunas, ilustração por ativo e os mesmos dados do painel.
6. Build, lint e testes limpos; coleta diária e envio do boletim seguem funcionando.
