# Termômetro da Praça T2 — UI de moderação (design)

> Fatia 9. Aprovar/rejeitar a fila de reportes pendentes pelo celular, sem abrir o
> dashboard do Supabase. Um único moderador (o dono do projeto).

## Objetivo

Hoje a moderação do Termômetro (fatia 8) exige abrir o dashboard do Supabase e editar
a coluna `status` na mão. Esta fatia entrega a página **`/moderar`**: protegida por
senha, mostra a fila de pendentes com contexto de preço (referência CONAB) e dois
botões grandes — Aprovar e Rejeitar — utilizáveis no celular.

**Sem migração de banco.** A tabela `reportes` (status `pendente`/`aprovado`/
`rejeitado`, RLS: público só lê aprovado, escrita só service role) já tem tudo.

## Decisões de design

- **Proteção: senha única + cookie assinado** (escolhida entre Supabase Auth e HTTP
  Basic). Proporcional a "só eu modero", zero dependências novas, uma env var nova
  (`MODERACAO_SENHA`). O cookie é assinado por HMAC derivado da própria senha, então
  **trocar a senha derruba todas as sessões**.
- **Escopo da tela: fila + contexto CONAB.** Só pendentes (sem histórico/desfazer —
  fica para depois se fizer falta). Cada card traz a referência CONAB do produto
  quando existir (boi/soja/milho, tabela `cotacoes`), para julgar plausibilidade sem
  sair da tela.
- **Padrão do app:** API routes + client components com fetch (como o FormReporte),
  Vitest + Testing Library, identidade visual da fatia 7. Zero dependências novas.

## Arquitetura

```
lib/moderacao.ts                    # lógica pura: token, senha, validação (testável isolada)
app/api/moderar/login/route.ts      # POST { senha } → Set-Cookie
app/api/moderar/decidir/route.ts    # POST { id, decisao } → atualiza status (service role)
app/moderar/page.tsx                # server component: sem sessão → login; com → fila
components/FormLoginModeracao.tsx   # client: campo de senha
components/FilaModeracao.tsx        # client: cards com Aprovar/Rejeitar (otimista)
```

### `lib/moderacao.ts` (lógica pura, `node:crypto`)

- `criarToken(agora: number, senha: string): string` — `"{expira}.{assinatura}"`,
  onde `expira` = `agora` + 30 dias (epoch ms) e `assinatura` =
  HMAC-SHA256(chave = senha, mensagem = `"moderador.{expira}"`) em hex.
- `verificarToken(token: string, agora: number, senha: string): boolean` — formato,
  expiração e assinatura (comparação de tempo constante via `timingSafeEqual`).
- `verificarSenha(tentativa: string, senha: string): boolean` — tempo constante
  (SHA-256 de ambas antes do `timingSafeEqual`, para igualar comprimentos).
- `validarDecisao(body: unknown)` — união no padrão de `validarReporte`:
  `{ tipo: 'invalido'; erro: string } | { tipo: 'valido'; id: string; decisao: 'aprovado' | 'rejeitado' }`.
  `id` precisa ter formato UUID; `decisao` só aceita os dois literais.

Constantes: `COOKIE_MODERACAO = 'moderacao'`, validade 30 dias.

### `POST /api/moderar/login`

1. `MODERACAO_SENHA` ausente no ambiente → 500 `"Moderação não configurada."`.
2. Espera fixa de ~800 ms em TODA resposta (sucesso e falha) — freia força bruta e
   não vaza timing.
3. Senha errada → 401 `"Senha incorreta."`.
4. Senha certa → 200 + `Set-Cookie: moderacao={token}` com `HttpOnly`, `Secure`
   (fora de dev), `SameSite=Lax`, `Path=/`, `Max-Age` 30 dias.

### `POST /api/moderar/decidir`

1. Cookie ausente/inválido/expirado → 401.
2. Body inválido (`validarDecisao`) → 400 com o erro.
3. Service role: `update reportes set status = {decisao} where id = {id} and
   status = 'pendente'` — só pendente pode ser decidido; repetir clique ou decidir
   algo já moderado → 404 `"Reporte não encontrado ou já moderado."` (checando as
   linhas afetadas do update, sem SELECT prévio — sem TOCTOU).
4. Sucesso → 200 `{ ok: true }`.

### `/moderar` (server component, `force-dynamic`)

- Lê o cookie com `cookies()` (`next/headers`) e verifica com `verificarToken`.
- **Sem sessão:** renderiza `FormLoginModeracao` — campo de senha + botão Entrar;
  no sucesso do POST, `router.refresh()` recarrega a página já autenticada.
- **Com sessão:** busca com o **service role** (`createServerClient` — a RLS esconde
  pendentes do anon): `id, produto, municipio, valor, criado_em` de `reportes` com
  `status = 'pendente'`, mais recente primeiro. Busca `cotacoes` (`tipo, valor`)
  para o mapa CONAB, como em `/termometro`.
- **Erro de banco mostra erro** ("Não consegui carregar a fila — tente recarregar"),
  nunca disfarçado de fila vazia (lição do backlog da fatia 8).
- Fila vazia → "Fila limpa — nenhum reporte pendente."
- `metadata`: título "Moderação — Praça Araguaia" e `robots: { index: false }`.
  A página NÃO entra no menu do Header.

### `FilaModeracao` (client)

- Recebe `reportes` (com rótulo/unidade resolvidos de `PRODUTOS`) e `conab`
  (referência por produto, quando houver).
- Card: rótulo + unidade como etiqueta, valor grande em pt-BR (`font-display`,
  números tabulares), município, tempo relativo ("há 2 h", "há 15 min"), linha
  "CONAB: R$ 326,96" quando aplicável. Botões Aprovar (verde `pasto`) e Rejeitar
  (neutro/contorno), área de toque generosa (mobile-first).
- Clique → remoção **otimista** do card + POST `/api/moderar/decidir`; erro →
  card volta e mensagem aparece; 401 → recarrega a página (sessão expirou →
  cai no login).

## Segurança

- Comparações de senha e assinatura em tempo constante.
- Cookie HttpOnly (JS não lê), SameSite=Lax, assinado — não dá para forjar sem a senha.
- `decidir` valida sessão E body; update restrito a `status = 'pendente'`.
- Espera fixa no login contra força bruta (sem estado, suficiente para o risco real).
- Service role continua só no servidor, como nas rotas existentes.

## Testes (padrão Vitest das fatias anteriores)

- `lib/moderacao.ts`: token ida-e-volta, expirado, adulterado (assinatura e expira),
  formato inválido; senha certa/errada/vazia; `validarDecisao` (UUID inválido,
  decisão fora dos literais, body não-objeto, caso válido).
- Rotas: login sem env / senha errada / senha certa (verifica Set-Cookie e atributos);
  decidir sem cookie / body inválido / sucesso / já moderado (Supabase mockado, como
  nos testes de `/api/reportar`).
- `FilaModeracao`: renderiza cards com contexto; aprovação otimista remove o card;
  falha do POST devolve o card e mostra erro.
- E2E manual local antes do deploy: login errado→certo, aprovar e rejeitar de
  verdade, reporte aprovado aparecendo em `/termometro`.

## Deploy

1. Definir `MODERACAO_SENHA` em `.env.local` E nas Environment Variables da Vercel
   **antes do push** (senha forte, gerada — não reaproveitar outras).
2. Push na `master` → deploy automático. Verificação em produção: login, aprovar um
   reporte de teste, conferir em `/termometro`, apagar o dado de teste.

## Fora do escopo (T3 e além)

Histórico com desfazer, notificação de novos pendentes, múltiplos moderadores com
contas, OTP por telefone para produtores, reputação, mediana/corte de outliers.
