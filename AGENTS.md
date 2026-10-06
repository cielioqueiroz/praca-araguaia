# AGENTS.md

Guia para agentes de código (Claude Code, Codex, Cursor) trabalhando neste repositório.

Este arquivo é **só o que não está escrito em outro lugar**. Onde a verdade já mora:

| Assunto | Arquivo |
|---|---|
| Vocabulário do domínio — o que cada palavra significa aqui | [`CONTEXT.md`](CONTEXT.md) |
| Estado atual, o que está no ar, ponto de retomada | [`ESTADO-DO-PROJETO.md`](ESTADO-DO-PROJETO.md) |
| Decisões arquiteturais com razão registrada | [`docs/adr/`](docs/adr/) |
| Conceito do produto, público, princípios | [`conceito-praca-araguaia.md`](conceito-praca-araguaia.md) |
| Stack, fontes de preço, modelo de dados, setup | [`README.md`](README.md) |
| Spec e plano de cada fatia entregue | [`docs/superpowers/`](docs/superpowers/) |

**Leia `CONTEXT.md` antes de escrever qualquer texto de tela, mensagem de bot ou nome de variável.** As palavras de lá têm sentido fixo. Quando uma delas aparecer com outro sentido, o certo é corrigir o texto — não esticar o sentido.

---

## Comandos

```bash
npm run dev              # http://localhost:3000
npm run build            # build de produção
npm start                # sobe o build
npm test                 # Vitest, uma passada (hoje: 589 testes)
npm run test:watch       # watch
npm run lint             # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck        # tsc --noEmit — tem que dar ZERO

npx vitest run tests/termometro.test.ts          # um arquivo
npx vitest run -t "mediana resiste a outlier"    # um teste pelo nome
```

**`npm run typecheck` tem que dar zero.** Ele existe porque não existia: sem ninguém rodando `tsc`, treze erros se acumularam em `tests/` sem que ninguém visse — o `next build` não typechecka `tests/`, e o `lint` não pega tipo. Todos foram corrigidos; qualquer erro que aparecer agora é da mudança em curso.

A raiz dos treze era a mesma: `vi.fn(async () => ...)` sem assinatura faz o TypeScript inferir a tupla de argumentos como `[]`, e `mock.calls[0][0]` não compila. **Tipe o mock com a assinatura real** (`vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ...)`) em vez de calçar um `as` no ponto da asserção. E `init` é opcional de verdade — `typeof fetch` é sobrecarregado, e mock com `init` obrigatório não é atribuível a ele.

Primeira coleta local (a tela começa vazia):

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/coletar
```

---

## Onde as coisas moram

Pasta **não** é rota. No App Router só `page.tsx` e `route.ts` criam URL; o prefixo `_` é o opt-out explícito de roteamento do Next. Isso é o que permite colocar componente dentro de `app/`.

**A regra: a distância do arquivo até quem o usa reflete quantos o usam.**

| Quem usa | Onde mora |
|---|---|
| Só o root layout (cromo persistente) | `app/_chrome/` |
| Só a home | `app/_home/` |
| Só uma rota | `app/<rota>/_components/` |
| Só uma subárvore de rotas | `app/<subarvore>/_components/` |
| Duas ou mais rotas sem ancestral comum | `components/` (achatado) |
| shadcn/ui | `components/ui/` — não editar à mão |
| Lógica de negócio pura | `lib/` |
| Tipos compartilhados | `types/` |

Antes de mover ou criar um componente compartilhado, **conte os consumidores por alcance transitivo** — um componente pode pertencer a uma rota só através de outro. Grep de import direto mente.

[`app/layout.tsx`](app/layout.tsx) é o único arquivo que 100% dos acessos pagam. Tem três responsabilidades e nenhuma outra: a casca do documento (`<html>`, `<body>`, fontes, `globals.css`), o metadata padrão, e o cromo. Qualquer outra coisa ali chegou por acidente.

Não existe `middleware.ts`. Os headers de segurança são aplicados via `headers()` em [`next.config.ts`](next.config.ts).

---

## Convenções de código

**Tudo em português** — nomes de arquivo, funções, variáveis, tipos, testes, mensagens de commit, comentários. `buscarNoticias`, `ordenarPorPraca`, `ReportePendente`, `FaixaSemana`. Não misture: `fetchPrices` num arquivo de `buscarPrecos` é inconsistência, não estilo.

**Comentário explica POR QUE, nunca O QUE.** O padrão da casa é registrar a decisão e o defeito que ela evita, com o dado concreto quando existe. Exemplo real de [`lib/cron.ts`](lib/cron.ts):

> `POR QUE ISTO EXISTE: a comparação era auth !== \`Bearer ${process.env.CRON_SECRET}\`. Com a env ausente, o segredo vira a string literal "Bearer undefined" — e a rota FALHA ABERTA.`

Se o comentário some e ninguém sente falta, ele não devia existir. Se alguém reintroduziria o bug sem ele, ele é obrigatório.

TypeScript `strict` — e o projeto tem **zero `any`**. Mantenha assim. Alias `@/*` → raiz. Dentro da mesma rota use caminho relativo (`./_components/X`); atravessando rotas, use `@/`.

**Nunca escreva `new Intl.*` numa página ou componente.** Número e data vêm de [`lib/formato.ts`](lib/formato.ts): `numero(valor, casas)`, `numeroEnxuto(valor)`, `dataExtensa`, `dataLonga`, `horaLocal`. A chave de dia do Araguaia (`'2026-08-25'`) é `dataLocal()` de [`lib/dia-util.ts`](lib/dia-util.ts). Havia 48 `Intl` espalhados e o fuso digitado à mão em quinze lugares — uma regra repetida é uma regra que diverge, e data errada aqui é da mesma família de dano que preço errado. Formato genuinamente de um lugar só (o eixo do gráfico, os dias da chuva em UTC) continua local: não infle o módulo compartilhado com reuso que não existe.

---

## Dados e fontes

**Adicionar uma cotação é registrar uma função.** Uma fonte por arquivo em `lib/fontes/`, registrada em [`lib/fontes/registry.ts`](lib/fontes/registry.ts) (`FONTES` para a coleta diária, `FONTES_HISTORICO` para o backfill). A orquestração em [`lib/coleta.ts`](lib/coleta.ts) não muda.

**A lógica de negócio é pura e testada.** Mediana, faixa, agregação, validação, sessão de moderação, view-models do boletim e do gráfico — tudo em `lib/`, sem React e sem I/O. É aí que os testes vivem de verdade; componente se testa por comportamento visível.

**Dois clientes Supabase, e escolher errado é falha de segurança:**

- [`lib/supabase/public.ts`](lib/supabase/public.ts) — chave `anon`, sob RLS. É o de leitura em página.
- [`lib/supabase/server.ts`](lib/supabase/server.ts) — service role. **Só** em route handler ou server component que escreve.

RLS desde a primeira migration: `SELECT` público (em `reportes`, só linhas `aprovado`); todo `INSERT/UPDATE/DELETE` foi revogado de `anon`. Nenhuma escrita passa pelo cliente.

Migrations em `supabase/migrations/`, numeradas e aplicadas em ordem. Alterar schema é criar arquivo novo, nunca editar um aplicado.

**Toda rota de cron passa por `autorizadoPorCron()`** de [`lib/cron.ts`](lib/cron.ts) — falha fechada, comparação em tempo constante. Nunca compare o Bearer na mão: sem a env, a comparação ingênua vira `"Bearer undefined"` e a rota abre para todo mundo. Duas dessas rotas fazem broadcast irreversível.

Feriado nacional é barrado dentro da rota, em [`lib/dia-util.ts`](lib/dia-util.ts) — o cron da Vercel sabe o dia da semana, não sabe que hoje é Natal.

**`npm audit` tem que dar zero, e o `overrides` do package.json é o motivo.** As vulnerabilidades restantes viviam em dependências TRANSITIVAS (`sharp` e `postcss`, que o Next embute; `esbuild`, do vitest), e o `npm audit fix --force` "resolvia" subindo o Next para a major 16. O `overrides` fixa a versão corrigida de cada uma sem trocar de framework. **Não rode `npm audit fix --force`** — ele desfaz isso e arrasta um major num site que está no ar. Se um override deixar de ser necessário porque o Next passou a trazer a versão boa, aí sim ele sai.

Envs (todas em [`.env.local.example`](.env.local.example)): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `MODERACAO_SENHA`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_DONO_CHAT_ID`. As seis últimas são server-only — nunca sob `NEXT_PUBLIC_*`.

---

## Regras de domínio que o código precisa respeitar

Estas não são preferências. Cada uma existe porque já quebrou.

**Reposição nunca é arroba.** Bezerro e novilha se negociam por cabeça. Tratar novilha como gordo já produziu R$ 39.840 numa novilha de 400 kg.

**Nunca "média" na interface.** A palavra saiu na fatia 15 e não volta: o spread entre estados é grande demais para uma média significar preço de alguém. O que se publica é **valor típico** (mediana) e **faixa** (menor–maior).

**0% não é alta — é `estável`.** A tela mostra *desde quando* o preço está parado, não um zero. Preço parado repete a variação em vez de zerá-la. Ver "Variação do lugar" e "Estável desde" no `CONTEXT.md`.

**O gado é D-1 por natureza.** A Scot publica à tarde e sempre o fechamento do dia útil anterior. "Fechamento de hoje" não existe para o gado; isso não é bug e não se conserta.

**Preço velho leva selo.** Mais de 5 dias (fonte diária) ou 10 (semanal) → `desatualizado`. Repetir número parado com cara de novidade foi o que já fez o dado parecer inventado.

**Crédito duplo na Scot:** "Scot Consultoria, via Notícias Agrícolas" onde houver espaço para texto. No card compacto, "Scot" + data. Nunca apresentar como apuração nossa. Ver [ADR 0001](docs/adr/0001-indicador-scot-via-noticias-agricolas.md).

**Troca de fonte se marca, não se apaga.** Mesmo produto e mesma unidade com outro apurador → marca a data em [`lib/trocas-de-fonte.ts`](lib/trocas-de-fonte.ts) e o gráfico desenha a linha. Unidade ou produto diferente → aí sim apaga. Ver [ADR 0002](docs/adr/0002-troca-de-fonte-marcada-nao-apagada.md).

**Reporte tem origem, e a tela diz qual.** `produtor` (formulário público, anônimo) e `praca` (apurado por telefone pela Praça, lançado pela moderação). Os dois entram no cálculo; nenhuma tela mostra o valor sem dizer de quem veio. Ver [ADR 0003](docs/adr/0003-reporte-apurado-pela-praca.md).

**Nada de terceiro aparece sem moderação** — nem reporte, nem fornecedor.

**Uma cidade nunca vê preço de fora sem a tela dizer de onde ele é** (praça de referência aparece sempre nomeada).

---

## Tela

**100% do público chega pelo celular.** Não é "também funciona no mobile" — é o alvo.

Tokens da paleta terra vivem no `@theme` de [`app/globals.css`](app/globals.css): `bone`, `paper`, `ink`, `olive`, `leather`, `ochre`, alta em `moss`, baixa em `rust`, chuva em `agua`. **Nunca neon.** Use os tokens, não hex solto. Há um bloco de nomes legados (`mata`, `pasto`, `palha`…) remapeado para a paleta nova — não crie mais nenhum.

Tipografia via `next/font`: Playfair Display (display), Archivo (UI e números), JetBrains Mono (dados, ticker, timestamps). As CSS vars mantêm nomes antigos (`--font-fraunces/hanken/plex-mono`) de propósito, para não churnar o CSS.

**Nunca anime o valor de um preço.** Anime o lugar do número — opacidade, posição, revelação. A contagem crescente chegou a exibir 313,49 no lugar de 316,50 durante a hidratação: um preço errado na tela, ainda que por 400ms, é exatamente o dano que o produto não pode causar.

`prefers-reduced-motion` desliga o movimento da marca e as revelações.

---

## Antes de dizer que está pronto

1. `npm test` — verde.
2. `npm run build` — compila. **Derrube o `next dev` antes**: build com o dev de pé quebra os chunks.
3. Se mexeu em tela, **veja no celular de verdade**:

```bash
npx next start -p 3100        # o script espera a porta 3100
MSYS_NO_PATHCONV=1 node scripts/telas.mjs "/,/cotacoes,/termometro" mobile
```

[`scripts/telas.mjs`](scripts/telas.mjs) emula iPhone 13 pelo Playwright e acusa rolagem horizontal e alvo de toque pequeno. Ele existe porque **o Chrome headless no Windows tem largura mínima de ~500px** — "testar mobile" com `--window-size` mente. No Git Bash, `MSYS_NO_PATHCONV=1` é obrigatório, senão o argumento `/` vira um caminho do Windows.

Os prints saem em DPR 3 (1170px de largura): uma home de 18.000px CSS gera imagem de 54.000px. Isso é resolução, não repetição.

---

## Operação

**Retomada do Telegram autorizada pelo dono em 06/10/2026.** O único envio automático é o boletim de fechamento em dia útil, depois da coleta. Abertura, alertas e resumo de audiência continuam sem cron. A rota exige coleta completa do dia e reserva única em `envios_boletim` antes de enviar; falha parcial exige revisão manual, pois repetir o disparo duplicaria mensagens. Na Vercel Hobby, o cron pode iniciar a qualquer momento dentro da hora agendada.

As rotas de envio continuam de pé — prévia (`?previa=1`) e disparo manual funcionam. Por isso: **nunca acione uma rota irreversível antes de confirmar que o commit está no ar** (`vercel inspect`). HTTP 200 não distingue código velho de código novo, e não há como desenviar um broadcast.

Deploy é automático no push para `master`. `vercel.json` carrega os crons de coleta e fechamento.

---

## Git

Commits em português, no formato `tipo(escopo): frase em minúscula`, com corpo que explica **por que** e **o que isso custou ou evitou** — o histórico deste repo é documentação, não changelog. Veja `git log` para o tom.

O ciclo de trabalho é a **fatia vertical fina**: `brainstorming → spec → plano → implementação (TDD) → review → deploy verificado`, uma por vez, com spec e plano em `docs/superpowers/`.
