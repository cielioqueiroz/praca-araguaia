# Verdade das fontes, distribuição e a semente do Termômetro — 18/08/2026

> Veio de uma sessão de **grilling** (não do `/brainstorming`): seis perguntas de
> frontier, todas respondidas e aprovadas pelo dono de uma vez. O que segue é o
> desenho que saiu delas.

## O diagnóstico que abriu a sessão

Medido em 18/08/2026, no banco de produção:

| | |
|---|---|
| Coleta | 🟢 viva, sem buraco na série |
| Boletim do Telegram | ⏸️ pausado desde 28/07 (3 semanas) |
| Assinantes | 3 |
| Visitas registradas | 30 acessos, 9 dias, 6 cidades, a última em 10/08 |
| Reportes do Termômetro | 0 |
| Fornecedores na vitrine | 0 |

**O produto está pronto e vazio.** Não falta software; falta gente. Daí o objetivo do
ciclo ser **distribuição** — e não mais funcionalidade, que é a armadilha de construir
para não ter de divulgar.

E três contradições de domínio, achadas cruzando os documentos com o código:

1. O `conceito-praca-araguaia.md` §4.3 proibia a Scot **pelo nome**, e a fatia 17 passou
   a usá-la.
2. A série do boi mistura CONAB e Scot na mesma linha, sem marca.
3. Não havia `CONTEXT.md` nem ADR nenhum — e "praça" já tinha três sentidos, enquanto
   "novilha" (arroba × cabeça) já custara um bug de 13× na calculadora.

## As decisões (Q1–Q6)

1. **Objetivo do ciclo: distribuição.**
2. **Boletim volta só no fechamento** (18:00 BRT / 21:00 UTC), uma entrega por dia útil.
   Duas mensagens por dia para 3 assinantes é ruído, e o card da abertura carrega o gado
   de anteontem.
3. **A Scot fica**, com a regra reescrita e a atribuição completa → [ADR 0001](../../adr/0001-indicador-scot-via-noticias-agricolas.md).
4. **A troca de fonte é marcada, não apagada** → [ADR 0002](../../adr/0002-troca-de-fonte-marcada-nao-apagada.md).
5. **O Termômetro é semeado com preço apurado por nós, assinado como tal** → [ADR 0003](../../adr/0003-reporte-apurado-pela-praca.md).
6. **`CONTEXT.md`**: o glossário do projeto, só vocabulário.

## O que foi construído

### A — Verdade das fontes
- `CONTEXT.md`, `docs/adr/0001..0003`, §4.3 e §11 do conceito reescritos.
- `FONTE_PORTEIRA` ganhou `via`; `creditoFonte()` e `creditosDaPorteira()` são a fonte
  única do crédito. Rodapé do site e linha de fontes de `/cotacoes` passam a dizer
  **"Scot Consultoria, via Notícias Agrícolas"**. O card compacto segue com "Scot · 17/08",
  onde só cabem duas palavras.
- `lib/trocas-de-fonte.ts` (puro) + marca no `GraficoCotacao`: linha tracejada na data e
  a nota "CONAB até 10/07 · Scot Consultoria desde 15/07 — mesma unidade, apurador
  diferente". Some sozinha na janela de 7/30 dias, que é toda da fonte nova. O gráfico do
  Termômetro **não** recebe `tipoCotacao` de propósito: reporte não muda de fonte.

### B — Distribuição
- Cron do fechamento de volta no `vercel.json` (a abertura fica fora).
- `lib/compartilhar.ts` (puro): convite por alvo, com o link no fim da mensagem para o
  WhatsApp montar a prévia. `wa.me/?text=` sem destinatário — quem envia é o usuário,
  nenhuma API paga no caminho.
- `BotaoCompartilhar`: é um link `wa.me` que funciona sem JS; onde existe folha de
  compartilhamento nativa, o clique abre ela. Cancelar não é erro.
- `ConviteDistribuicao` — a faixa escura do boca a boca, na home, em `/cotacoes` e no
  `/termometro`, com texto próprio em cada uma. Vem depois do conteúdo, que é a ordem do
  conceito §9 (dar valor antes de pedir).
- `/boletim` refeita na linguagem editorial: hero, o card emoldurado e um painel com as
  três saídas — mandar, baixar, assinar. Antes só existia "Baixar imagem" numa página
  cujo propósito inteiro é sair daqui.

### C — Semente do Termômetro
- Migração `0014_reportes_origem.sql`: `origem in ('produtor','praca')`, default `produtor`.
- `POST /api/moderar/reporte` (cookie da moderação): mesma validação do formulário
  público — apuração nossa não fura faixa nem lista de município —, grava `aprovado` +
  `origem='praca'`.
- `FormReporteApurado` na aba Preços do `/moderar`, antes da fila (que hoje está vazia).
- `procedencia()` e `origensDoProduto()` puros; a frase aparece no card do Termômetro, no
  card da porteira em `/cotacoes` e no card do boletim. **Nenhuma tela mostra o valor sem
  dizer de quem ele veio.**

## Verificação

- 559 testes, lint e build limpos.
- Telas conferidas no navegador (1440px): `/boletim`, `/termometro`, `/cotacoes`, home.
- E2E local contra o banco de produção: `POST /api/moderar/reporte` → 401 sem cookie,
  400 fora da faixa, 200 com cookie; o card apareceu com o selo **"apurado pela Praça"** e
  a linha do card da porteira virou "Termômetro · apurado pela Praça". O registro de teste
  foi apagado por id (`reportes` voltou a 0).
- O marcador de troca de fonte é estado do componente (não da URL), então foi verificado
  por teste de componente com o relógio congelado em 18/08/2026.

## O que NÃO foi feito

- Semear de verdade o Termômetro e a vitrine: isso é ligação para produtor e agropecuária
  — a ferramenta está pronta, a lista é do dono.
- Cron da abertura (07:30): fica fora até haver público que justifique duas entregas.
- Divulgação em si (grupos, Instagram parceiro): fora de código.
