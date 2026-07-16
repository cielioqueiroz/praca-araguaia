# Notícias do Mercado, Scot por praça, painel de audiência e busca

> Spec das fatias 16 a 19 + micro-fatia 0. Data: 2026-07-16.
> Decisões já tomadas com o dono (ver "Decisões travadas").

## Contexto

O app está no ar e o dono gostou do resultado. Este ciclo tem quatro pedidos independentes:

1. Uma seção **"Notícias do Mercado"** que vira a página principal — estilo portal de notícias, porém limpo.
2. Boi gordo, vaca gorda e novilha devem vir da **Scot Consultoria** (a mesma origem do bezerro).
3. Um jeito de **ver quem se inscreveu no Telegram e quem acessa o site, por cidade** — sem identificar ninguém.
4. A **busca do cabeçalho não faz nada** e o hero da home não tem vida.

Restrição permanente do projeto: **só ferramentas grátis**.

## Decisões travadas

| Questão | Decisão |
|---|---|
| Novilha na Scot | Scot **reposição 18 meses (R$/cabeça)** — a Scot não publica novilha gorda em R$/@ |
| Granularidade de boi/vaca | **Por praça**, só as da região do Araguaia |
| Notícias | **RSS + ISR, sem banco e sem cron** |
| Audiência | **`/painel`** (senha do `/moderar`) **+ resumo diário no Telegram** |
| Home | `/` = só notícias; painel de cotações migra para `/cotacoes` |

## Achados da investigação (o que mudou o desenho)

- **O bezerro nunca veio "da Scot" diretamente.** Vem de `noticiasagricolas.com.br/cotacoes/boi-gordo/macho-nelore-bezerro-12-meses`, que republica o indicador Scot (`lib/fontes/pecuaria.ts:29`). Vaca e novilha de hoje são **Datagro**, não Scot.
- A página **`/cotacoes/boi-gordo/boi-gordo-scot-consultoria`** ("Mercado Físico") traz **Boi Gordo à vista**, **Boi Gordo prazo 30 dias** e **Vaca Gorda**, todos em R$/@, com **32 praças** — incluindo **Marabá, Redenção e Paragominas (PA)**, **Norte e Sul do TO**, **Norte/Sudoeste/Cuiabá/Sudeste (MT)** e **Goiânia/Sul (GO)**. Isso é mais fino que a média CONAB atual e mais próximo da porteira do usuário. Não há novilha nessa página.
- A **novilha Scot** existe só como reposição: `/cotacoes/boi-gordo/femea-nelore-novilha-18-meses`, em **R$/cabeça** e **R$/kg**, por UF (SP, MG, GO, MS, BA, MT, PR, PA, RO, TO, AC, MA, RJ) — mesmo formato do bezerro.
- **Cron de hora em hora não existe no plano grátis da Vercel** (Hobby dispara 1×/dia) e o `vercel.json` já declara 3 jobs. Daí notícias por ISR e o resumo de audiência pegando carona num cron existente.
- O **`<input>` da busca** (`components/redesign/Masthead.tsx:76`) é decorativo: sem `value`, sem `onChange`, sem `form`. Digitar nele não faz nada.
- **`assinantes_telegram` só tem `chat_id` e `criado_em`** (migração 0004). O Telegram não expõe cidade do usuário — a cidade precisa ser capturada no site, no momento do clique.

---

## Micro-fatia 0 — tirar o "2024"

Remover o texto `Cotações do agro, 2024` de `components/redesign/Masthead.tsx:54` e `components/redesign/SiteFooter.tsx:57`, deixando `Cotações do agro`. Sem ano: a marca não envelhece sozinha.

---

## Fatia 16 — Notícias do Mercado

### Rotas

- `/` → **Notícias do Mercado** (`export const revalidate = 1800`).
- `/cotacoes` → o painel de hoje, movido de `app/page.tsx` sem mudança de comportamento (segue `force-dynamic`).
- Menu: `Notícias` (`/`) · `A praça hoje` (`/cotacoes`) · Boletim · Chuva · Termômetro · Fornecedores · Calculadora.
- O `TickerStrip` do topo continua em todas as páginas — preço não some da primeira tela.

### Módulos (a lógica pura não toca a rede)

```
lib/noticias/
  feeds.ts        # registry: { id, veiculo, url, secao } — espelha lib/fontes/registry.ts
  rss.ts          # parseFeed(xml) -> ItemBruto[]   (RSS 2.0 <item> e Atom <entry>)
  classificar.ts  # categoria(item) e relevante(item) por palavra-chave
  agregar.ts      # juntar + deduplicar + ordenar + limitar
  buscar.ts       # ÚNICO com I/O: Promise.allSettled sobre os feeds
types/noticia.ts  # ItemBruto, Noticia, Categoria
```

`Noticia = { id, titulo, link, veiculo, publicadoEm, categoria, imagem?, resumo? }`

### Fontes (RSS, grátis, sem chave)

G1 Agronegócios, G1 Economia, Globo Rural, Canal Rural, Notícias Agrícolas, CNN Brasil (economia), InfoMoney, Money Times, R7 Economia, Agrolink.

Cada URL é **verificada no primeiro passo da implementação**; feed que não responder ou não parsear sai da lista antes do commit. Nenhum feed é adicionado sem retorno HTTP 200 e itens parseáveis.

### Regras

- **Link direto para a raiz.** O card aponta para o `<link>` do próprio veículo (`target="_blank"`, `rel="noopener noreferrer"`). Nada de redirect intermediário — foi o motivo de recusar o Google News RSS.
- **Resiliência.** `Promise.allSettled` + `AbortSignal.timeout(8000)` por feed; feed morto é ignorado e registrado com `console.error`. Zero feed bom → estado vazio amigável, nunca erro 500.
- **Relevância.** Feeds amplos (G1 Economia, CNN, R7) trazem notícia sem relação com o agro. `relevante()` exige pelo menos uma palavra-chave no título ou resumo: boi, gado, pecuária, arroba, frigorífico, bezerro, soja, milho, safra, grão, plantio, colheita, agro, agronegócio, fazenda, dólar, ouro, commodities, Ibovespa, seca, chuva. Feeds já do nicho (Canal Rural, Notícias Agrícolas, Globo Rural, Agrolink) passam direto.
- **Categoria** por palavra-chave: `pecuaria` · `graos` · `mercado` · `clima` · `geral` (fallback).
- **Deduplicação:** por `link` normalizado (sem query de tracking) e por título normalizado (sem acento, minúsculo) — o mesmo fato sai em vários veículos.
- **Ordem:** `publicadoEm` desc. Limite de 40 itens. Item sem data válida vai para o fim, nunca é descartado.
- **Fuso:** `America/Araguaina`, como o resto do app.

### Interface

Nas cores existentes (`mata`, `pasto`, `palha`, `papel`, `linha`, `tinta`, `rio`) e nas fontes atuais — sem token novo.

- **Destaque:** a notícia mais recente e relevante, foto grande, título em serif.
- **Grade:** 3 colunas em desktop, 2 em tablet, 1 em telefone. Cada card: etiqueta do veículo (mono, maiúscula), título, tempo relativo ("há 2 h").
- **Chips de filtro:** Tudo · Pecuária · Grãos · Mercado · Clima. Filtro é client-side sobre a lista já carregada (sem ida ao servidor).
- **Imagens:** `<img loading="lazy">` com a URL do feed (o projeto já usa `<img>` puro; `next/image` exigiria liberar dezenas de domínios). Feed sem imagem → bloco de cor com a inicial do veículo. Sem hotlink quebrado visível.
- **Sem** vídeo, carrossel, publicidade ou blocos aninhados — é o "menos poluída" pedido.

### Testes

`parseFeed` (RSS e Atom, CDATA, item sem data, XML quebrado), `relevante`/`categoria`, `agregar` (dedupe por link e por título, ordenação, limite). Tudo puro, sem rede.

### Fora de escopo

Busca dentro das notícias, histórico, notícia no Telegram, comentários, paginação infinita.

---

## Fatia 17 — Scot por praça (boi, vaca, novilha)

### Dados

Nova tabela (migração **0008**):

```sql
create table cotacoes_praca (
  tipo text not null,
  praca text not null,        -- 'Redenção', 'Marabá', 'Norte' ...
  uf text not null,
  valor numeric not null,
  unidade text not null,
  variacao_pct numeric,
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now(),
  primary key (tipo, praca, uf)
);
```
RLS igual à `cotacoes_uf`: leitura pública, escrita só service role.

### Fontes

- `lib/fontes/scot.ts` — parser da página "Mercado Físico": tabela por praça com **Boi Gordo à vista**, **prazo 30 dias** e **Vaca Gorda**. Grava `boi` e `vaca` em `cotacoes_praca` (o preço à vista é o do card; o prazo entra como detalhe secundário do boi).
- `lib/fontes/pecuaria.ts` — a novilha troca de página: `femea-nelore-novilha-18-meses`, R$/cabeça, por UF, `temVariacao: false` (a 2ª coluna é R$/kg, igual ao bezerro). Vaca sai deste arquivo (vai para a Scot por praça); bezerro fica.

### Praças da região (as únicas exibidas)

PA: Marabá, Redenção, Paragominas · TO: Norte, Sul · MT: Norte, Sudoeste, Cuiabá, Sudeste · GO: Goiânia, Sul.
Praça ausente na tabela é **omitida, nunca zerada** (regra que `pecuaria.ts` já segue).

### Compatibilidade

- `cotacoes` + `cotacoes_historico` continuam recebendo o **valor único** (média das praças da região) — é o que alimenta o gráfico de `/cotacao/[tipo]`, que não muda.
- A CONAB **continua** coletando boi/soja/milho: soja e milho seguem sendo dela, e o boi CONAB vira o contraste do Termômetro (que já usa "média CONAB").
- `CardPorteira` passa a aceitar preços por praça além de por UF. Novilha muda de unidade (R$/@ → R$/cab): `UNIDADE_PORTEIRA` e `rodapeDaFonte` acompanham.

### Risco assumido

O contrato é HTML de terceiro. Se a página mudar, o parser devolve vazio e **só aquele tipo falha**, sem derrubar as outras fontes — o comportamento que `pecuaria.ts` já garante.

---

## Fatia 18 — Painel de audiência

### Como a cidade é descoberta

O Telegram não informa cidade. Duas capturas, ambas no site:

1. **Acesso:** `POST /api/visita` lê os headers de geo da Vercel (`x-vercel-ip-city` — vem **URL-encoded** —, `x-vercel-ip-country-region`, `x-vercel-ip-country`). Só conta `country === 'BR'`. Disparado por um beacon client **1× por sessão** (`sessionStorage`), para não contar cada navegação.
2. **Inscrição:** o CTA "Receber no Telegram" vira link com carga: `https://t.me/pracaaraguaia_bot?start=<base64url("cidade|uf")>`, montado no servidor com o geo do visitante. O webhook decodifica no `/start` e grava `cidade`/`uf` junto do `chat_id`.

A carga do `start` é **validada** (tamanho ≤ 64, decodifica para `cidade|uf` com UF de 2 letras) e descartada se não bater — é dado de analytics, forjá-la não dá acesso a nada, mas lixo não entra no banco.

### Dados (migração 0008, mesmo arquivo da fatia 17)

```sql
alter table assinantes_telegram add column cidade text, add column uf text;

create table visitas (
  dia date not null,
  cidade text not null,
  uf text not null,
  acessos int not null default 0,
  primary key (dia, cidade, uf)
);
```
`visitas` com RLS fechada (só service role). Incremento atômico por função `registrar_visita(dia, cidade, uf)` — `insert ... on conflict do update set acessos = visitas.acessos + 1`. Sem isso, dois acessos simultâneos perdem contagem.

### Onde o dono vê

- **`/painel`** — protegida pelo cookie `moderacao` que já existe (`lib/moderacao.ts`), `robots: noindex`, fora do menu. Mostra: total de inscritos, inscritos por cidade, acessos de hoje e dos últimos 7 dias por cidade, e o ranking — no formato pedido: **"Ouricuri-PE — 2 inscritos · 5 acessos hoje"**.
- **Resumo diário no Telegram** — `enviarResumoAudiencia()` chamada no fim de `/api/alertas`, guardada por `TELEGRAM_DONO_CHAT_ID`. **Pega carona de propósito:** o plano grátis limita cron e o `vercel.json` já tem 3 jobs. Sem a env, não envia nada.

### Privacidade

Só cidade/UF **agregados**. Nada de IP, nome, telefone ou `chat_id` na interface — ninguém é identificável nem no painel, que ainda por cima tem senha. Isso mantém a linha do Termômetro (reporte anônimo) e do `SuaPraca` (coordenada não sai do dispositivo).

---

## Fatia 19 — Busca funcional + hero com vida

### Busca

Hoje o `<input>` é enfeite. Vira uma busca real, **client-side e sem backend**:

- `lib/busca.ts` (puro, testável): `indiceBusca()` monta o índice a partir do que já existe — `TITULOS`/`PORTEIRA` (produtos → `/cotacao/[tipo]` e `/termometro/[produto]`), `MUNICIPIOS` (cidades → `/chuva`, `/termometro`) e as páginas do menu. `buscar(indice, consulta)` normaliza (sem acento, minúsculo) e casa por prefixo/substring nos termos, com resultados agrupados.
- `components/redesign/Busca.tsx` (client) substitui o input morto: lista suspensa agrupada (Produtos · Cidades · Páginas), navegação por ↑/↓, Enter navega, Esc fecha, clique fora fecha. Atalho `/` foca o campo. Presente também na gaveta do celular.
- Estado vazio: "Nada encontrado para X".
- Acessível: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, resultado ativo anunciado.

### Hero

`.hero .photo` (`app/globals.css:230-235`) ganha, em **CSS puro**, sem JS:

- Zoom lento na foto no hover (`transform: scale(1.06)`, ~700ms, curva suave) — o `overflow:hidden` que já existe segura o corte.
- Gradiente do `.overlay` aprofunda e a `.tag` sobe alguns pixels.
- Brilho/saturação sutis, sem estourar a foto.
- `@media (prefers-reduced-motion: reduce)` desliga o movimento — regra de acessibilidade que vale para todo efeito novo.

Nada disso muda layout (só `transform`/`opacity`/`filter`), então não há reflow nem CLS.

---

## Ordem de implementação

Micro-fatia 0 → 16 → 17 → 18 → 19. Cada uma: build + lint + testes verdes e push (a Vercel deploya sozinha no push da `master`).

## Critérios de sucesso

- Abrir `agroapp-bay.vercel.app` cai nas **Notícias do Mercado**, com notícias reais de veículos diferentes; clicar abre o site raiz numa aba nova.
- Nenhum "2024" na interface.
- Boi e vaca mostram **Redenção, Marabá, Paragominas** e as demais praças da região, com a Scot creditada; novilha em R$/cabeça.
- `/painel` (com a senha) lista cidades com inscritos e acessos; o bot manda o resumo diário.
- Digitar "boi" na busca leva à página do boi; a foto do hero reage ao mouse.
- Testes atuais (305) continuam passando **sem serem alterados**, exceto os que a mudança de rota ou de unidade da novilha obrigar.
