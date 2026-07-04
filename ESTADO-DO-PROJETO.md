# Estado do Projeto — agro_app (Praça Araguaia)

> **Documento de retomada.** Última atualização: 2026-07-04.
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

**Estado atual:** 177 testes passando, build/lint limpos, 6 cotações + boletim + chuva + Termômetro completo (reporte anônimo, moderação própria em `/moderar`, mediana/faixa e histórico por produto), identidade visual própria. README profissional atualizado no GitHub (com diagramas Mermaid).

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

1. **Bot de Telegram (grátis)** — boletim diário (reaproveita o PNG de `/api/boletim`) + alertas de preço para inscritos; substitui o "alertas no WhatsApp" pago. Telegram Bot API é gratuita.
2. **Vitrine de insumos/fornecedores** — diretório curado com contato por link `wa.me` (grátis, sem API).
3. **Termômetro T3 restante** — OTP + reputação: exigem provedor pago + PII, então só se o usuário decidir bancar. A mediana/faixa (fatia 10) e o histórico (fatia 11) já saíram.

### Dívidas técnicas pequenas (anotadas nas reviews)
- Moderação (`/moderar`): botões Aprovar/Rejeitar sem `aria-label` por card e mensagens de erro sem `role="alert"`/`aria-live` (a11y); casts do mock de `fetch` acusam no `tsc` dos testes (padrão já existente no repo); endurecer o HMAC do cookie (derivar chave de um segredo separado da senha) se um dia houver mais de um moderador.
- Chuva: `AbortSignal.timeout` no fetch da Open-Meteo; `console.error` no catch da página (hoje a falha não deixa rastro nos logs); reter o último dado bom na revalidação (hoje um blip da API troca dados bons por "indisponível" por até 1h); validar temperaturas por elemento (`Number(null)` vira 0 silencioso); card com grid de colunas fixas.
- Formatação de valor/variação duplicada entre `lib/boletim.ts` e `components/CardCotacao.tsx` — consolidar num helper (`lib/formatacao.ts`) numa fatia futura.
- Recorte **municipal** da CONAB (`PrecosSemanalMunicipio.txt`) para aproximar da "Praça Araguaia" de verdade.
- Backfill de **ouro** (sem fonte histórica grátis definida ainda).
- Tipos gerados do Supabase (`supabase gen types`) para tipar as queries.
- `salvar` não é transacional (upsert em `cotacoes` + histórico em 2 chamadas) — risco baixo numa coleta diária.

---

## Ponto de retomada

Quando voltar: o app está **100% funcional com 6 cotações (boi, soja, milho via CONAB; dólar, euro, ouro), boletim diário em `/boletim`, previsão de chuva em `/chuva` e o Termômetro da Praça completo** — reportes anônimos em `/termometro/reportar`, **valor típico (mediana) + faixa** em `/termometro`, **histórico por produto** em `/termometro/[produto]`, e **moderação própria pelo celular em `/moderar`** (senha na env `MODERACAO_SENHA` da Vercel, projeto `agro_app`). O usuário pediu **só ferramentas grátis** — a próxima fatia mais provável é o **bot de Telegram** (boletim/alertas grátis) ou a **vitrine de fornecedores** (link `wa.me`). É só dizer e eu inicio pelo `/brainstorming`.

Specs/planos recentes em `docs/superpowers/`: fatia 9 (`2026-07-04-termometro-t2-moderacao-*`), fatia 10 (`2026-07-04-termometro-t3-mediana-*`) e fatia 11 (`2026-07-04-termometro-historico-*`).
