# Boletim Diário em Card — Design

> Design doc — 2026-07-03 — Fatia 5 da Praça Araguaia.
> Gera uma imagem compartilhável (PNG 1080×1080) com as cotações do dia, para o produtor/administrador postar no Instagram e WhatsApp. Amplia o alcance do que as fatias 1–4 já coletam.

## 1. Contexto e decisões

O painel já tem 6 cotações no ar (boi, soja, milho via CONAB; dólar, euro, ouro). O produtor da região consome informação principalmente por WhatsApp/Instagram — um card diário pronto para postar é o caminho de divulgação mais barato.

**Decisões (validadas com o usuário):**
- **Uso:** página `/boletim` mostra o card do dia com botão "baixar imagem"; a imagem vive numa URL fixa (`/api/boletim`). Postagem manual — automação (APIs da Meta) fica fora de escopo.
- **Formato:** quadrado **1080×1080** (feed do Instagram; bom no WhatsApp). Story 1080×1920 fica para depois, se fizer falta.
- **Marca:** **"Praça Araguaia"** assina o card (com o broto do favicon); o endereço do site aparece no rodapé.
- **Tecnologia:** `ImageResponse` do **`next/og`** (Satori), embutido no Next.js 15 — **zero dependências novas**. Descartados: screenshot com Chromium serverless (pesado/frágil na Vercel) e geração no cliente com html2canvas (sem URL fixa, resultado varia por dispositivo).
- **Tipografia:** fonte default do Satori (Noto Sans, cobre pt-BR) nesta fatia; fontes custom só se o visual pedir depois.

**Fora de escopo:** postagem automática, formato story, card por cotação individual, histórico de boletins.

## 2. Conteúdo do card (1080×1080)

- **Cabeçalho:** broto (SVG do favicon) + "Praça Araguaia" + data por extenso em pt-BR (ex.: "sexta-feira, 3 de julho de 2026").
- **Corpo:** as 6 cotações na ordem do painel (`ORDEM_PAINEL`: boi, soja, milho, dólar, euro, ouro). Cada linha: título (`TITULOS`), valor formatado pt-BR com unidade (ex.: "R$/@ 326,96"), variação com seta ▲/▼ e cor (verde `#059669` / vermelho `#dc2626`); sem variação (null) → linha sem o bloco de %.
- **Nota das commodities:** "média MT/PA/TO/GO" discreta junto às 3 primeiras (reusa `LEGENDAS`).
- **Rodapé:** "fontes: CONAB · BCB · BCE" + "agroapp-bay.vercel.app".
- Visual: fundo claro (creme/branco), verde do projeto como cor de destaque, hierarquia por tamanho/peso — sem imagem de fundo.

## 3. Arquitetura

```
lib/boletim.ts                 view-model puro e testável
  montarBoletim(linhas, agora) → { dataExtenso, itens: [{ titulo, valorFmt, variacao?, legenda? }] }
    - ordena por ORDEM_PAINEL (desconhecidos ao fim)
    - formata valor pt-BR (2–4 casas, como o painel) prefixado pela unidade
    - variacao: { texto: '0,4%', direcao: 'alta' | 'baixa' } ou undefined
    - dataExtenso via Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' })

app/api/boletim/route.tsx      rota pública GET (sem CRON_SECRET — dado público)
  lê cotacoes via createPublicClient() → montarBoletim → ImageResponse (next/og) 1080×1080
  Cache-Control: public, s-maxage=3600, stale-while-revalidate (1 boletim/dia; 1h de cache basta)
  banco vazio → card "Ainda sem cotações hoje" (200, não 500); erro de banco → 500

app/boletim/page.tsx           página pública
  <img src="/api/boletim"> + <a href="/api/boletim" download="boletim-praca-araguaia.png">Baixar imagem</a>
  link "← Voltar" para o painel

app/page.tsx                   link discreto "Boletim do dia →" (para /boletim)
```

- O JSX do `ImageResponse` usa o subconjunto flexbox do Satori (sem Tailwind — estilos inline).
- O broto: reusar o path do `app/icon.svg` como SVG inline no card.
- Nenhuma migração de banco; nenhuma env var nova.

## 4. Erros e casos de borda

| Cenário | Comportamento |
|---|---|
| `cotacoes` vazia | Card válido com "Ainda sem cotações hoje" (200). |
| Falta uma cotação (ex.: CONAB falhou por dias) | Renderiza as existentes; sem placeholder. |
| Erro do Supabase | 500 com mensagem simples. |
| `variacao_pct` null | Linha sem o bloco de variação. |
| Cotação desatualizada | Sem selo no card nesta fatia — o card mostra a data do boletim, não de cada dado. |

## 5. Testes (TDD)

- `montarBoletim`: ordem correta (commodities primeiro, desconhecido ao fim); formatação de valor com unidade; variação alta/baixa/null; legenda só nas commodities; data por extenso pt-BR determinística (injetar `agora`).
- Rota `/api/boletim`: 200 + `content-type` começando com `image/`; banco vazio → 200; erro do client → 500 (Supabase mockado).
- Página `/boletim`: fora dos testes unitários (páginas não são testadas no projeto) — verificação via build + smoke manual.

## 6. Critérios de sucesso

1. `GET /api/boletim` devolve PNG 1080×1080 com as 6 cotações do dia, marca Praça Araguaia e data por extenso.
2. `/boletim` mostra o card e o botão baixa o arquivo `boletim-praca-araguaia.png`.
3. Painel tem o link "Boletim do dia".
4. Banco vazio não derruba a rota (card de estado vazio).
5. Testes passam; build/lint limpos; deploy na Vercel com a imagem acessível publicamente.
