# Estado do Projeto — agro_app (Praça Araguaia)

> **Documento de retomada.** Última atualização: 2026-07-24.
> Quando voltar, comece por aqui. Tudo está commitado e no ar.

---

## 🧮 Calculadora: novilha por cabeça (bug), e página refeita (24/07/2026)

**O bug (relatado pelo dono):** na seção "Gado na balança", a novilha usava a conta
do boi — `peso × rendimento ÷ 15 = arrobas`, × preço. Mas neste projeto a novilha é
**reposição, vendida por cabeça**, igual ao bezerro. Com R$ 2.988/cabeça num campo
"R$/@", uma novilha de 400 kg dava **R$ 39.840** (13× o real). **Correção:** novilha
saiu da balança para uma seção de reposição (R$/cabeça) ao lado do bezerro; a balança
ficou só com boi e vaca.

**Mesma raiz, no Termômetro:** `lib/termometro.ts` marcava `novilha: R$/@, 130–550` —
rejeitava o reporte real (~R$ 2.971/cab) como fora da faixa. Corrigido para
`R$/cabeça, 800–6000`.

**Página refeita** no sistema editorial (como a /chuva): hero com uma **balança
animada em GSAP** (assenta o fiel ao carregar) e o **resultado de cada conta contando
até o total em anime.js**. A contagem do resultado NÃO fere a regra "nunca animar o
valor de um preço" — ali é cotação publicada; aqui é a conta do próprio produtor, e o
valor final é cravado exato. Ver [[agro-app-nunca-animar-o-valor-do-preco]].

520 testes; build limpo; verificado no navegador e em produção.

---

## 🌧️ A seção de chuva refeita, GSAP + anime.js, e a revisão (24/07/2026)

A página `/chuva` era a única do site ainda em utilitários do Tailwind, presa num
`max-w-3xl`, sem hero e sem síntese: 5 municípios × 7 dias = 35 linhas de igual
peso, e numa semana seca 30 delas eram traço e barra vazia. Agora:

- **`lib/chuva-resumo.ts`** (lógica pura, 13 testes) resume os municípios numa
  leitura da região: total da semana, primeiro dia relevante (≥ 1 mm — orvalho de
  0,2 mm **não** vira manchete), dia mais molhado, escala do maior dia.
- **Hero editorial** com manchete que sai do dado ("A chuva chega sexta-feira" /
  "Sem chuva à vista" / "Previsão indisponível") e um **pluviômetro em SVG**
  animado com **GSAP** (a água sobe, a superfície ondula, a chuva cai).
- **Faixa da semana** (7 colunas) e **cards** redesenhados na linguagem do site;
  as barras entram com **stagger do anime.js**. O dia seco recua, o de chuva avança.
- GSAP e anime.js entram por **import dinâmico** — só baixam nesta rota, depois da
  primeira pintura. Nenhum byte deles pesa na home nem no painel.

**A revisão de código encontrou e corrigiu 3 defeitos reais além do redesign:**

1. **"Sem chuva à vista" com a API fora do ar** — a página montava a manchete a
   partir do resumo de uma lista vazia, então negava chuva sem ter dado. Falha de
   fonte agora tem manchete própria e o pluviômetro marca "—", não 0,0 mm. (É o
   mesmo princípio do "preço zero é mentira, ausência é verdade".)
2. **`/api/chuva-local` derrubava com header malformado** — `decodeURIComponent`
   sem try/catch e coordenada sem validação (virava `latitude=NaN` na URL). A
   fatia 20 já tinha corrigido isso em `/api/geo` e `/api/visita`; esta rota tinha
   ficado de fora. Agora com 6 testes (`tests/api/chuva-local.test.ts`).
3. **Barras horizontais animadas no eixo errado** — o anime.js achatava a barra
   do card na vertical durante a entrada. O eixo agora vem declarado no HTML
   (`data-barra="x"` / `"y"`).

521 testes passando; build limpo; verificado no navegador (desktop, mobile,
reduced-motion, e os dois eixos de barra terminando visíveis).

---

## 🐄 O gado "congelado", as notícias fora do ramo e a nova agenda (23/07/2026)

O dono relatou três coisas: o card do Telegram chegava com o gado parado num preço
antigo, apareciam notícias de celebridade, e os valores tinham cara de mockados.
**Não havia nada mockado no código** — nenhum fallback com número fixo, e a tabela
`reportes` está vazia. Era isto:

1. **A coleta rodava cedo demais.** Às 09:00 BRT as páginas da Scot ainda não tinham
   publicado o fechamento do dia. Medido em 23/07: a coleta das 09:40 gravou boi com
   fechamento de **21/07**; às 20:27 a mesma página já mostrava 22/07. O card de
   quinta dizia "Scot · 21/07" — dois dias atrás — e, com o fim de semana, boi e vaca
   repetiam o mesmo número de sexta a terça.
2. **O gado não tinha seta nenhuma.** A Scot não publica variação por praça
   (boi/vaca) nem nas páginas de reposição (novilha/bezerro): os quatro chegavam com
   `variacaoPct` null enquanto soja e milho mostravam a da CONAB. Agora
   `variacaoDoLugar` (lib/coleta.ts) tira a variação do preço anterior salvo para
   aquele mesmo lugar — preservando a variação quando o fechamento se repete, para o
   cron diário não zerar a alta de sexta no sábado.
3. **"▲ 0%" verde.** `pct >= 0` caía em 'alta'. 0% virou direção própria
   (`estavel`): traço e cor neutra, no card e nas três telas do site.
4. **Notícias.** `nicho: true` dispensava o filtro de relevância — foi por aí que
   entrou "Angelina Jolie trocou Hollywood pelas colmeias" (Compre Rural) e "Como
   montar uma horta em casa" (Globo Rural). O passe livre acabou; entrou lista de
   bloqueio (entretenimento, esporte, culinária, o gênero "dicas de cultivo") e clima
   deixou de bastar sozinho. Medido: G1 Agro 100→53, Globo Rural 100→48.
5. **O card avisa quando o preço está velho** ("· desatualizado", passado o prazo da
   fonte). Repetir número parado com cara de novidade foi o que criou a impressão de
   dado inventado.

### A agenda nova (4 crons, todos `1-5`)

| Rota | UTC | BRT | O quê |
|---|---|---|---|
| `/api/enviar-boletim?sessao=abertura` | 10:30 | 07:30 | o preço com que o dia começa |
| `/api/coletar` | 20:30 | 17:30 | depois da B3 (17:00) e da Scot |
| `/api/enviar-boletim?sessao=fechamento` | 21:00 | 18:00 | o número do dia, apurado |
| `/api/alertas` | 21:15 | 18:15 | movimentos + resumo de audiência |

**O plano aceita 4 crons** — conferido com `vercel crons ls` depois do deploy (o
comentário antigo de "o plano grátis só dá três" está superado).

Sábado, domingo e **feriado nacional** não têm envio: o cron recorta segunda a sexta,
mas quem conhece feriado é `lib/dia-util.ts` (fixos + os três móveis de Páscoa, via
algoritmo gregoriano anônimo). Nenhum feriado municipal ou estadual. A prévia do dono
passa no domingo.

### Motion

O quadro se preenchendo: cada preço sobe uma fração de linha e ganha nitidez,
escalonado; a seta chega do lado para onde aponta; a sparkline se desenha da esquerda
para a direita. CSS puro, `prefers-reduced-motion` respeitado.

> **Registrado para não repetir:** a primeira versão fazia o número VIAJAR do preço de
> ontem até o de hoje. No navegador, a arroba de Goiás saía
> `316,50 → 313,49 → … → 316,50`: o 313,49 aparece na hidratação, e por um instante a
> tela mostrava um preço falso. **Anima-se o lugar do número, nunca o valor.**

---

## ✅ Situação (17/07/2026)

O deploy voltou a disparar (o "🔴 auto-deploy parou" de 16/07 era a **outage do
GitHub** daquele dia, não uma configuração quebrada — resolveu sozinho). As fatias
16-19 estão em produção: `/` serve as Notícias do Mercado, `/cotacoes` e `/painel`
saíram do 404.

**As env vars estão todas na Vercel** (conferido em 17/07 com `vercel env ls production`):
`MODERACAO_SENHA`, `TELEGRAM_DONO_CHAT_ID` (= `8896839605`), `CRON_SECRET`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, as três do Supabase. Nada pendente do
dono. O resumo diário de audiência já chega no Telegram do dono pelo cron de alertas.

---

## 🐂 Boi/vaca por estado + só o Ouro (fatia 21 — 17/07/2026)

A pedido do dono, a porteira de **boi e vaca** parou de repetir região (dois "Norte",
dois "Sul", dois "Oeste"). Agora: as **3 cidades do Pará** (Marabá, Paragominas,
Redenção) + **uma linha por estado** — Mato Grosso, Tocantins, Goiás, Bahia, Maranhão
—, rotulada com o nome do estado e trazendo o valor da **praça de referência da Scot**
mais próxima do Araguaia (MT→Norte, TO→Norte, GO→Goiânia, BA→Oeste, MA→Oeste). Goiás
voltou. Decisão registrada: **praça de referência, não média** (respeita o "fim das
médias" da fatia 15). A linha que já é o estado não repete a sigla ("Mato Grosso"); a
cidade do PA mantém a etiqueta ("Marabá · PA").

No **Mercado**, o ouro 18k saiu: fica só o **Ouro** em R$/grama. Removido de todo o
código; migração 0013 apaga o tipo do banco e limpa as praças antigas de
`cotacoes_praca`. A coleta de 17/07 já repopulou as 8 praças novas (conferido).

O **card do Telegram** foi atualizado no mesmo golpe (boi/vaca agora com BA e MA, igual
ao site) — altura conferida renderizando o PNG (sem estouro, rodapé limpo). O boletim
segue recortando os produtos por-UF (soja/milho/novilha/bezerro) à casa (PA/MT/TO/GO);
só boi/vaca mostram BA/MA. Se o dono quiser BA/MA em soja/milho no card, é um passo a
mais.

---

## 🔒 Endurecimento de segurança (fatia 20 — 17/07/2026)

Auditoria completa do app. A base já era sólida (RLS nega por padrão, service role
nunca no cliente, cookie HttpOnly+HMAC, sem segredo versionado). Seis correções:

1. **`/api/boletim` era uma torneira de CPU.** Rota pública, ~8s por render, e o `?t=`
   aceitava qualquer valor — cada um um cache miss. Um laço de curl queimava a cota do
   plano grátis e derrubava o site todo. Agora a query vai **assinada** com o
   `CRON_SECRET` (`lib/boletim-url.ts`): sem query → card do dia cacheado; com query →
   só a que o envio diário assina. Público que inventa `?t=` leva 404.
2. **As 4 rotas de cron falhavam ABERTAS.** `auth !== \`Bearer ${env}\`` virava
   `Bearer undefined` sem a env — e duas dessas rotas fazem broadcast irreversível.
   `lib/cron.ts`: sem `CRON_SECRET`, nega todo mundo; compara com `timingSafeEqual`.
3. **Login da moderação sem limite de tentativas.** A espera de 800ms atrasava mas não
   travava. Agora 10 falhas em 15 min → 429 (`tentativas_login`, migração 0012).
4. **`ipHash` era SHA-256 do IP puro** — reversível por força bruta (IPv4 inteiro).
   Virou HMAC com o `CRON_SECRET` como sal (`lib/ip.ts`), compartilhado por
   reportar/fornecedores/login.
5. **Sem headers de segurança.** `next.config.ts` ganhou `X-Frame-Options`,
   `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
6. **`/api/geo` derrubava com 500** se o header de geo viesse malformado
   (`decodeURIComponent` sem try/catch, que o `/api/visita` já tinha).

Dívida anotada, não urgente: `next` 15.5.19 → 16.x quando der (3 avisos do
`npm audit`, todos em postcss/esbuild de build/dev, não exploráveis em runtime).

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

### Fatia 7 — Redesign visual (identidade Praça Araguaia)
- Tokens Tailwind v4 nomeados pelo assunto (`mata`, `pasto`, `palha`, `papel`, `linha`, `tinta`, `rio`) + fonte display **Bricolage Grotesque** (números tabulares grandes como assinatura).
- Header verde-mata com marca e nav (Cotações · Boletim · Chuva) + footer com fontes, em todas as páginas.
- Painel agrupado em **"Na porteira"** (boi/soja/milho — regional/semanal) e **"Mercado"** (câmbio/ouro — diário); cards em papel com unidade como etiqueta.
- `/chuva` com barras proporcionais de mm e colunas alinhadas; título da aba → "Praça Araguaia — cotações do agro".
- Zero mudanças de comportamento: 101 testes passaram **sem alterar nenhum teste**; boletim PNG intocado.

### Fatia 8 — Termômetro da Praça T1 (capturar e mostrar)
- **Reporte anônimo** em `/termometro/reportar` (boi R$/@, bezerro R$/cabeça, vaca R$/@, soja e milho R$/sc — nos 5 municípios da chuva), sem cadastro; validações de faixa plausível, honeypot real e limite de 5 por IP/24h (`POST /api/reportar`, service role).
- Tabela `reportes` (migração 0003, aplicada) com RLS: público só lê `aprovado`; escrita revogada de anon/authenticated (defesa em profundidade).
- **Moderação v1:** mudar `status` na tabela `reportes` pelo dashboard do Supabase (pendente → aprovado/rejeitado). T2 = UI de moderação; T3 = OTP/reputação/mediana.
- `/termometro`: média dos últimos 7 dias por produto (regional + por município) com contagem e contraste "média CONAB" para boi/soja/milho; item Termômetro no header.
- Backlog anotado: página mascara erro de banco como estado vazio; município editado à mão fora da lista some da quebra; mensagem imprecisa p/ valor não numérico; TOCTOU no soft-limit.

### Fatia 9 — Termômetro da Praça T2 (UI de moderação)
- **`/moderar`** protegida por senha (não entra no menu, `robots: noindex`): sem sessão mostra tela de senha; com sessão, a fila de reportes pendentes (mais recente primeiro) com valor, município, tempo relativo e a **referência CONAB** do produto — botões grandes Aprovar/Rejeitar, mobile-first.
- **Auth de moderador único:** `POST /api/moderar/login` compara `MODERACAO_SENHA` (env) em tempo constante, com espera fixa de 800 ms em toda resposta (anti-brute-force), e grava cookie `moderacao` HttpOnly/SameSite=Lax de 30 dias, assinado por HMAC-SHA256 com a própria senha (**trocar a senha derruba todas as sessões**). `POST /api/moderar/decidir` exige cookie válido + body válido; update restrito a `status='pendente'` (0 linhas → 404, sem TOCTOU).
- **Fila com remoção otimista:** card some no clique; erro devolve só o card da decisão que falhou (não atropela decisões concorrentes); 401 recarrega para a tela de senha. Sem migração de banco (a tabela `reportes` já bastava).
- Lição de arquitetura: `lib/moderacao.ts` importa `node:crypto`, então os itens usados pelo componente client (`tempoRelativo`, tipos) foram extraídos para `lib/moderacao-tipos.ts` — sem isso o `node:crypto` vazava para o bundle do navegador e o build quebrava.
- T3 = OTP por telefone/WhatsApp para produtores, reputação, mediana/corte de outliers.
- Backlog anotado: botões Aprovar/Rejeitar sem `aria-label` por card e erros sem `role="alert"`/`aria-live` (a11y); casts do mock de `fetch` acusam no `tsc` dos testes (padrão já existente); endurecer o HMAC (derivar chave de um segredo separado) se um dia houver mais de um moderador.

### Fatia 10 — Termômetro T3 (sub-fatia 1): mediana + faixa
- `/termometro` agora mostra o **"valor típico" (mediana)** dos reportes aprovados dos últimos 7 dias, no lugar da média — **imune a 1-2 preços absurdos** (um reporte de R$ 900/@ no boi não puxa mais o número). Mais a **faixa** (menor–maior reportado), exibida só quando há 2+ reportes com dispersão.
- Só lógica pura + exibição: `mediana()` em `lib/termometro.ts` (2 casas, par = média dos dois centrais), `ResumoProduto` troca `media` por `mediana` + `faixa`, `CardTermometro` mostra "valor típico" e a linha de faixa; contraste "média CONAB" mantido. Sem banco, deps, PII ou rotas.
- A robustez já é reforçada pela faixa plausível na entrada (validação do reporte), então **sem corte estatístico extra** (IQR/desvio) — desnecessário com o volume atual.
- Próximas sub-fatias do T3 (não iniciadas): **OTP** por telefone/WhatsApp (provedor pago + PII — rompe com "fontes grátis", decidir se vale) e **reputação** por reportador (depende de identidade estável, ou seja, do OTP).

### Fatia 11 — Histórico do Termômetro
- Nova página **`/termometro/[produto]`** (espelha `/cotacao/[tipo]`): card atual (valor típico dos últimos 7 dias) + **gráfico da tendência da mediana diária** dos últimos 90 dias, com o toggle 7/30/90 — reaproveitando o `GraficoCotacao` inteiro (zero componente novo de gráfico).
- `historicoTermometro()` puro em `lib/termometro-historico.ts`: agrupa os reportes aprovados por dia (fuso America/Araguaina via `Intl` en-CA) e devolve a mediana de cada dia; um extremo no dia não puxa o ponto.
- Cards do `/termometro` viram **links** para a página de detalhe (com `aria-label`). Sem banco, deps, PII ou rotas de API.
- Detalhe do review: o card do detalhe usa a janela de **7 dias** (espelha a lista que o usuário clicou), enquanto o gráfico usa 90 dias.

### Fatia 12 — Vitrine de fornecedores
- Nova página **`/fornecedores`** (estática, no menu): diretório curado de agropecuárias/revendas/prestadores, filtrável por **categoria** (chips), com contato por link **`wa.me`** (mensagem pronta, grátis, sem API do WhatsApp).
- Dados curados em `lib/fornecedores.ts` (`FORNECEDORES` **começa vazio** — nenhum dado fictício no ar; estado "em breve"). `linkWhatsApp` e `agruparPorCategoria` puros e testados; uma **invariante de teste** protege o formato (`categoria` válida, `whatsapp` só dígitos DDI+DDD+número) quando os reais entrarem.
- Sem banco, deps, rotas de API ou PII de usuário. Categorias: Ração e sal · Defensivos e sementes · Veterinário · Máquinas e peças · Assistência técnica.
- **Pendente de conteúdo:** o dono envia os fornecedores reais (nome, categoria, município, WhatsApp com DDD) para um commit de dados.

### Fatia 13A — Bot de Telegram: inscrição + webhook (NO AR / LIGADO 🟢)
- **Ligado em 2026-07-04.** Bot **`@pracaaraguaia_bot`** criado no @BotFather (com comandos `/start` e `/parar` e descrição no menu); `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` cadastrados na Vercel (Production) e capturados por redeploy; webhook registrado (`setWebhook` apontando `https://agroapp-bay.vercel.app/api/telegram`, com `secret_token`) e saudável (`getWebhookInfo` sem erros). Teste e2e OK: `/start` respondeu e gravou o `chat_id` em `assinantes_telegram` (1 inscrito).
- `lib/telegram.ts` (`interpretarUpdate` + `enviarMensagem` + textos) e o webhook `app/api/telegram/route.ts`: responde a `/start` (upsert do `chat_id`), `/parar` (apaga) e ajuda; verifica o header `x-telegram-bot-api-secret-token`; sempre 200 (o Telegram re-tenta em não-200). Só guarda o `chat_id`; tabela com RLS fechada.
- Sub-fatias seguintes do bot (agora desbloqueadas): **B** (envio diário do boletim via cron + `sendPhoto` do PNG) e **C** (alertas de preço).

### Fatia 14 — Calculadora do produtor
- **`/calculadora`** (no menu, `force-dynamic`): valor de um lote de boi (peso vivo + rendimento → arrobas → R$) e de uma colheita de grãos (sacas → R$), com os **preços pré-preenchidos das cotações ao vivo** e editáveis. Só front + leitura de cotações; sem banco de escrita, deps ou PII.
- `lib/calculadora.ts` puro (`arrobasDeBoi`, `valorEmReais`, `sacas↔kg`; arroba do boi = 15 kg carcaça, rendimento padrão 50; guarda NaN/negativo → 0, nunca mostra NaN). Reusa `normalizarValor`.
- **Contexto:** substituiu a ideia de "cotações por município da CONAB", investigada e **descartada** — o arquivo municipal traz boi/soja/milho ~6 meses desatualizados (o estadual é fresco), e a CONAB quase não pesquisa os municípios da praça.

### Fatia 15 — Cotações honestas: ouro, cripto e preço por praça
- **Bug do ouro (fator 31) corrigido.** O gold-api cota a **onça troy**, e o painel/card rotulavam o número como `/g`: mostrávamos `R$ 21.095,39 /g` onde a grama vale ~R$ 678. `lib/fontes/ouro.ts` divide por `31,1034768` e grava `unidade: 'R$/g'`; a **migração 0005** converteu o que já estava em `cotacoes`/`cotacoes_historico` (guarda `valor > 5000` = idempotente), senão a coleta seguinte criaria um degrau falso de −96,8% no gráfico.
- **Bitcoin e Ethereum** (`lib/fontes/cripto.ts`, CoinGecko grátis e sem chave): atual + backfill de 90 dias. As duas moedas dividem uma resposta por coleta (limite de req/min do plano free).
- **Fim das médias.** A CONAB pesquisa **cada UF**, e a gente jogava fora essa granularidade. Nova tabela **`cotacoes_uf`** (migração 0006, upsert por `(tipo, uf)`) preenchida na mesma coleta, com a variação semana a semana calculada **do próprio arquivo** (não depende do banco). O spread era enorme: milho **PA 66,60 vs MT 40,20** — a "média" de 51,75 não era o preço de ninguém. A palavra "média" saiu da interface.
- **Cidade de verdade só existe pelo Termômetro.** Reinspecionei o `PrecosSemanalMunicipio.txt` em 12/07/2026: o último boi por município em MT/PA/TO/GO é de **26/12/2025** (~7 meses), soja para em 02/01/2026 e o milho recente só tem nível ATACADO. Confirma a decisão da fatia 14. Por isso o card do boi lista as 5 cidades da praça com a **mediana dos reportes aprovados (7 dias)** e convida quem não tem reporte.
- **Sua praça** (`lib/praca.ts` + `SuaPraca.tsx`): GPS do navegador com queda para os headers de geo da Vercel (padrão já validado no `SuaRegiaoChuva`); haversine roda no navegador, a coordenada não sai do dispositivo. Destaca a linha da UF/cidade via `data-uf`/`data-cidade` — **o painel continua Server Component**.
- **Painel menos poluído:** porteira em cards-lista (boi ocupa a largura toda) e **Mercado virou tabela compacta** (dólar, euro, ouro, BTC, ETH) no lugar de 5 cards com foto/selo.
- **Ticker do topo estava com preços FIXOS no código** (inclusive "OURO 21.699") — em todas as páginas. Agora lê `/api/ticker` das cotações reais.
- **Card do Telegram** em 2 colunas, 1080×**1350** (o 1:1 estourava com 12 linhas de estado), com **ilustração por ativo** (data URI — o Satori não busca imagem externa) e o bloco "Boi nas cidades". As artes de bitcoin/ethereum foram **desenhadas em SVG e rasterizadas com o sharp** (a cota grátis da IA de imagem estava zerada). O envio diário não mudou: `/api/enviar-boletim` já usa este PNG.

### Fatia 16 — Notícias do Mercado (a home mudou de dono)
- **`/` agora é a seção de notícias**; o painel de cotações foi para **`/cotacoes`** (2º item do menu). O ticker de preços do topo continua em todas as páginas, então preço não some da primeira tela.
- **9 feeds RSS** (`lib/noticias/feeds.ts`), lidos em paralelo com `allSettled` + timeout de 8s. **ISR de 15 min** + `router.refresh()` a cada 15 min na aba aberta (refresh **suave**: não perde rolagem nem filtro). Sem banco e sem cron — o plano grátis da Vercel só dispara cron 1×/dia, e o `vercel.json` já tem 3.
- Seções com divisória por assunto (Pecuária · Grãos · Mercado · Clima · Geral) + **etiqueta "Internacional"**, que é selo e não seção: "China suspende compra de carne" é PECUÁRIA (onde o pecuarista procura) *e* internacional.
- **Tudo apurado contra os feeds reais, não presumido:**
  - **Agrolink foi removido**: responde 200 com 49 itens, mas a notícia mais nova é de **02/07/2020**.
  - **R7, SBT e Band não publicam RSS** (nenhuma variação de URL responde). Notícias Agrícolas também não. Gazeta do Povo e Summit Agro devolvem HTML no lugar do feed.
  - `juros` trazia "Telefônica aprova JCP", `campo` trazia o Brasileirão, `tempo`/`previsao` traziam PIB → **vocabulário de relevância separado do de categoria**, que olha só o título.
  - Sem teto por veículo, InfoMoney e CNN tomavam 17 de 40 vagas e o G1 Agronegócios entrava com **uma**. Teto de 6/veículo (`LIMITE_POR_VEICULO`).
  - Todo feed WordPress carimba `The post ... appeared first on ...` no resumo → `limparResumo`.
  - **Money Times e BeefPoint não publicam imagem nenhuma** e o BeefPoint é a única fonte 100% pecuária → `lib/noticias/og.ts` busca a `og:image` da matéria só das que faltam (lendo só o `<head>`). **33/40 → 40/40 com foto, em 1,1s.**

### Fatia 17 — Scot por praça (boi, vaca, novilha)
- Boi e vaca saem da média CONAB/Datagro e passam a vir da **Scot, praça a praça**: Marabá, Redenção, Paragominas (PA), Norte/Sul (TO), Norte/Sudoeste/Cuiabá/Sudeste (MT), Goiânia/Região Sul (GO) — **11 praças**. Tabela nova `cotacoes_praca` (migração 0008).
- **Novilha trocou de produto** a pedido do dono: gorda (Datagro, R$/@) → **reposição 18 meses (Scot, R$/cabeça)**, na família do bezerro. A Scot não publica novilha gorda.
- **Migração 0009 apaga os 3 pontos de novilha gorda do histórico**: outro produto e outra escala — o gráfico desenharia um salto de **+900%** que nunca houve (a lição do ouro da fatia 15). Boi e vaca **mantêm** o histórico: mesma unidade, ~1% entre consultorias, e o boi tem 53 semanas.
- **Lição:** a página do Notícias Agrícolas é **UTF-8** (conferido byte a byte: `á` = `c3 a1`). Uma conclusão anterior de que era ISO-8859-1 veio de um artefato do `curl` no Windows — e forçar o decoder fazia **Marabá, Redenção, Cuiabá e Goiânia sumirem**. Só a CONAB (`PrecosSemanalUF.txt`) é ISO-8859-1.
- `prazoDesatualizadoMs` passou a **derivar de `FONTE_PORTEIRA`**: o boi virou diário, e uma lista paralela ainda lhe daria 10 dias de tolerância. Datagro saiu dos créditos (não é fonte de nada).
- Variação por praça mostra `—`: a Scot não publica, e não guardamos histórico por praça. Inventar comparando com a média regional seria pior.

### Fatia 18 — Audiência por cidade
- **`/painel`** (senha do `/moderar`, fora do menu, `noindex`): "Ouricuri-PE — 2 inscritos · 5 acessos hoje" + resumo diário no Telegram **do dono**.
- **O Telegram não informa cidade** — só `chat_id`. A cidade é capturada no site, no clique, e viaja na carga do link (`t.me/bot?start=<base64url>`); o `/start` decodifica e grava (migração 0010).
- **O resumo vai para UM chat** (`TELEGRAM_DONO_CHAT_ID`), nunca para os inscritos — **há um teste que trava isso** lendo o código de `lib/audiencia-envio.ts`.
- Decisões apuradas ao construir: o botão do Telegram é **client** (ler `headers()` no rodapé tornaria o layout dinâmico e **mataria o ISR da home**); o resumo vai no **começo** da rota de alertas (ela retorna cedo quando não há mover, que é a maioria dos dias); `/start@NomeDoBot` fazia `@PracaBot` virar a "cidade"; `x-vercel-ip-city` vem **URL-encoded**; `registrar_visita` incrementa **no banco** — verificado com 8 acessos simultâneos (1+8=9, nenhum perdido).
- **Privacidade:** só cidade, UF e contagem. Sem IP, sem nome, sem `chat_id` na tela. `visitas` com RLS fechada.

### Fatia 19 — Busca funcional
- O `<input>` do topo era **enfeite**: sem estado, sem submit — digitar não fazia nada, no desktop e na gaveta. Agora acha produto, cidade e página, com ↑/↓, Enter, Esc e `/`. Client puro sobre `lib/busca.ts`, sem rota nem banco.
- O índice nasce de `PORTEIRA`/`TITULOS`/`MUNICIPIOS` — cotação nova entra sozinha —, mais apelidos da praça ('gado' e 'arroba' → boi; 'zap' → boletim).
- Achado ao dirigir no navegador: as duas instâncias (cabeçalho e gaveta) colidiam — `id` duplicado, `/` disputado, campo da gaveta focável com o menu fechado. Resolvido com `useId` + prop `alcancavel`.
- O hero de `/cotacoes` ganhou hover (zoom lento, overlay, etiqueta subindo), com `prefers-reduced-motion` respeitado.

**Estado atual:** **467 testes passando**, build/lint limpos. No ar: **Notícias do Mercado na home** (9 veículos, 15 min) + **8 cotações** (boi e vaca **por praça** via Scot; novilha e bezerro **reposição por estado**; soja/milho por estado via CONAB; dólar, euro, ouro em R$/g, ouro 18k, Ibovespa, bitcoin, ethereum) + boletim + chuva + Termômetro + fornecedores + calculadora + **busca funcional** + **`/painel` de audiência**; bot `@pracaaraguaia_bot` ligado (**4 inscritos**).

> **Pendência de verificação:** o envio do boletim novo pelo Telegram não foi disparado à mão (é broadcast irreversível); o cron das 12:20 UTC entrega o card novo. Se algo sair torto na imagem, olhar `app/api/boletim/route.tsx`.

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

O usuário só quer **ferramentas grátis** — o que tira OTP/WhatsApp pagos do caminho por ora.

1. ~~**Ligar o bot de Telegram (13A)**~~ ✅ **feito em 2026-07-04** (`@pracaaraguaia_bot` no ar).
2. **Bot de Telegram B e C** — envio diário do boletim (cron + `sendPhoto` do PNG) e alertas de preço; **agora desbloqueados** (13A ligada).
3. **Conteúdo da vitrine** — receber do dono os primeiros fornecedores reais e adicioná-los a `lib/fornecedores.ts` num commit (estrutura já no ar).
4. **Termômetro T3 restante** — OTP + reputação: exigem provedor pago + PII, só se o dono decidir bancar.

### Dívidas técnicas pequenas (anotadas nas reviews)
- Moderação (`/moderar`): botões Aprovar/Rejeitar sem `aria-label` por card e mensagens de erro sem `role="alert"`/`aria-live` (a11y); casts do mock de `fetch` acusam no `tsc` dos testes (padrão já existente no repo); endurecer o HMAC do cookie (derivar chave de um segredo separado da senha) se um dia houver mais de um moderador.
- Chuva: `AbortSignal.timeout` no fetch da Open-Meteo; `console.error` no catch da página (hoje a falha não deixa rastro nos logs); reter o último dado bom na revalidação (hoje um blip da API troca dados bons por "indisponível" por até 1h); validar temperaturas por elemento (`Number(null)` vira 0 silencioso); card com grid de colunas fixas.
- Formatação de valor/variação duplicada entre `lib/boletim.ts`, `CardCotacao.tsx`, `CardPorteira.tsx` e `TabelaMercado.tsx` — consolidar num helper (`lib/formatacao.ts`) numa fatia futura.
- ~~Recorte **municipal** da CONAB~~ — **descartado de vez** (fatia 15): o arquivo está ~7 meses defasado para o boi. Cidade só pelo Termômetro.
- Backfill de **ouro** (sem fonte histórica grátis definida ainda).
- (removido) `CardCommodity.tsx` ficou órfão com o novo painel e foi apagado na fatia 15.
- Histórico **por UF** não existe: o gráfico de `/cotacao/[tipo]` ainda mostra a série regional (média) — se o dono quiser gráfico por estado, precisa de `cotacoes_uf_historico`.
- Tipos gerados do Supabase (`supabase gen types`) para tipar as queries.
- `salvar` não é transacional (upsert em `cotacoes` + histórico em 2 chamadas) — risco baixo numa coleta diária.

---

## Ponto de retomada (2026-07-16)

**Feito neste ciclo:** fatias 16 (notícias), 17 (Scot por praça), 18 (audiência) e 19 (busca) — spec em `docs/superpowers/specs/2026-07-16-noticias-scot-audiencia-design.md`. Migrações 0008/0009/0010 **já aplicadas** no Supabase.

**O que só o dono pode fazer** (ver o quadro no topo): criar `MODERACAO_SENHA` e `TELEGRAM_DONO_CHAT_ID` nas env vars da Vercel. Sem a primeira, `/moderar` e `/painel` não abrem para ninguém (falha fechada). Sem a segunda, o resumo de audiência não é enviado.

**Não verificado em produção:** o `/painel` e o resumo do Telegram foram validados **localmente** (login, cidade por header de geo, incremento sob concorrência). Em produção dependem das envs acima. O beacon de visita só conta de verdade atrás da Vercel — localmente os headers de geo não existem.

**Dívidas novas anotadas:** `components/Header.tsx` está órfão (nenhum import); o histórico do boi mistura CONAB (até 10/07) e Scot (a partir de 16/07) — mesma unidade, ~1% de diferença, mas é mistura; não há histórico por praça (a variação mostra `—`); os feeds RSS são contrato de terceiro e podem mudar sem aviso — a página aguenta (`allSettled`), mas vale reconferir a lista de tempos em tempos.

---

## Ponto de retomada (anterior)

Quando voltar: o app está **100% funcional com 6 cotações (boi, soja, milho via CONAB; dólar, euro, ouro), boletim diário em `/boletim`, previsão de chuva em `/chuva`, o Termômetro da Praça completo e a vitrine de fornecedores** — reportes anônimos em `/termometro/reportar`, **valor típico (mediana) + faixa** em `/termometro`, **histórico por produto** em `/termometro/[produto]`, **moderação própria pelo celular em `/moderar`** (senha na env `MODERACAO_SENHA` da Vercel), e **`/fornecedores`** (curado, link `wa.me`, começa vazio). O usuário pediu **só ferramentas grátis**. **Pendências abertas:** (a) ligar o bot de Telegram 13A (só ativação: BotFather + env + setWebhook — código já em prod, dormente); (b) popular a vitrine com fornecedores reais. Próximas fatias grátis: bot Telegram B (envio do boletim) e C (alertas). É só dizer e eu sigo.

Specs/planos recentes em `docs/superpowers/`: fatia 12 (`2026-07-04-vitrine-fornecedores-*`), fatia 13A (`2026-07-04-telegram-inscricao-*`) e fatia 14 (`2026-07-04-calculadora-produtor-*`).
