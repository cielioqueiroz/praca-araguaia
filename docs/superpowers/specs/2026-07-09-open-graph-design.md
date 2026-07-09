# Prévia de compartilhamento (Open Graph / WhatsApp) — Design

**Data:** 2026-07-09
**Contexto:** o público espalha a Praça Araguaia pelo WhatsApp, mas o site não tem
metadados Open Graph nem imagem — links colados em grupos aparecem como URL crua.

## Objetivo

Quando o link do site é compartilhado (WhatsApp, Facebook, etc.), aparecer um card
com imagem de marca + título + descrição. Autocontido, reaproveitando o `next/og`
já usado no boletim.

## Componentes

- `app/opengraph-image.tsx` (**novo**): imagem 1200×630 via `ImageResponse` do
  `next/og` — fundo `mata` (#1c3a2b), logo do broto, "Praça Araguaia" (branco,
  grande), tagline "Cotações do agro para o produtor do Araguaia" e a linha
  "cotações · boletim · chuva · termômetro · calculadora". Exporta `alt`, `size`
  (1200×630) e `contentType` ('image/png') pela convenção do Next. Estilos inline
  no subconjunto flexbox do Satori (todo div com múltiplos filhos-elemento tem
  `display: flex`).
- `app/twitter-image.tsx` (**novo**): re-exporta o `opengraph-image` (DRY) para
  gerar também `twitter:image`.
- `app/layout.tsx` (modificar): adicionar `metadataBase` (URL do site),
  `openGraph` (title, description, url, siteName, locale `pt_BR`, type `website`) e
  `twitter` (card `summary_large_image`, title, description). Com `metadataBase` +
  o arquivo de imagem, o Next injeta `og:image`/`twitter:image` absolutos sozinho.

## Testes

- `tests/opengraph-image.test.tsx` (mock `next/og` como no `boletim.test.ts`):
  `size` = {1200, 630}, `contentType` = 'image/png', `alt` contém "Praça Araguaia";
  a função default devolve uma resposta com `content-type` de imagem.

## Verificação pós-deploy

- `GET /opengraph-image` → 200 `image/png`.
- HTML de `/` contém `og:image`, `og:title`, `og:description` e `twitter:card`.
- (Opcional) validar num depurador de OG / colar o link num chat de teste.

## Restrições / fora de escopo

- Zero dependências novas (`next/og` já é usado). Imagem estática (não por rota
  dinâmica): a prévia do site é institucional, não muda por cotação. Uma prévia
  por-página com dados ao vivo fica pra depois (YAGNI).
