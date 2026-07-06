# Fornecedores com submissão + moderação — Design

**Data:** 2026-07-06
**Depende de:** Fatia 12 (vitrine `/fornecedores`, `lib/fornecedores.ts`) e o fluxo de
moderação da Fatia 8/9 (`reportes` + `/moderar` + senha `MODERACAO_SENHA`).

## Objetivo

Qualquer fornecedor/anunciante preenche um formulário público; o envio entra como
`pendente` (invisível ao público); o dono aprova/rejeita/remove em `/moderar`; só o
`aprovado` aparece na vitrine. Espelha o fluxo dos reportes de preço. Grátis, sem
dependências novas.

## Arquitetura

Espelha o fluxo `reportes`:

- **Submissão pública** → `POST /api/fornecedores` (service role) valida, aplica
  honeypot + limite por IP, insere como `pendente`.
- **Moderação** → `/moderar` ganha uma aba "Fornecedores"; lê pendentes e aprovados
  via service role; decisões vão em `POST /api/moderar/fornecedor` (cookie da mesma
  senha).
- **Vitrine** → `/fornecedores` deixa de ler o array estático e passa a **ler os
  aprovados do banco** via public client (a RLS filtra). Torna-se dinâmica
  (`force-dynamic`): baixo tráfego, aprovações no ar na hora.

### Tabela `fornecedores` (migração via Supabase MCP)

```sql
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  o_que_vende text not null,
  municipio text not null,
  whatsapp text not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','removido')),
  ip_hash text,
  criado_em timestamptz not null default now()
);
alter table fornecedores enable row level security;
-- anon só enxerga os aprovados (igual reportes); insert é sempre via service role.
create policy "anon le aprovados" on fornecedores
  for select to anon using (status = 'aprovado');
```

RLS ligada; anon **não** tem policy de insert (o `POST` usa service role). Service
role ignora RLS na moderação.

## Componentes

### `lib/fornecedores.ts` (modificar — puro)

Remove o `export const FORNECEDORES` estático. Mantém `CategoriaFornecedor`,
`CATEGORIAS`, `Fornecedor`, `linkWhatsApp`, `agruparPorCategoria`,
`GrupoFornecedores`, `MENSAGEM_PADRAO`. Adiciona:

```ts
export type ValidacaoFornecedor =
  | { tipo: 'honeypot' }
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; fornecedor: Fornecedor };

// Remove não-dígitos; prepende '55' se vier sem DDI (10–11 dígitos).
export function normalizarWhatsapp(texto: string): string;

export function validarFornecedor(body: unknown): ValidacaoFornecedor;

export type DecisaoFornecedor = 'aprovado' | 'rejeitado' | 'removido';
export type ValidacaoDecisaoFornecedor =
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; id: string; decisao: DecisaoFornecedor };
export function validarDecisaoFornecedor(body: unknown): ValidacaoDecisaoFornecedor;
```

Regras de `validarFornecedor` (todas as strings passam por `trim`):
- Corpo não-objeto → `invalido` "Envio inválido."
- Campo honeypot `contato` preenchido (não-vazio) → `honeypot` (mesmo nome dos reportes).
- `nome`: 2–60 caracteres, senão "Informe o nome do fornecedor.".
- `categoria`: precisa ser um id de `CATEGORIAS`, senão "Escolha uma categoria da lista.".
- `oQueVende`: 2–120 caracteres, senão "Descreva o que o fornecedor vende.".
- `municipio`: 2–60 caracteres (texto livre — fornecedor pode ser de qualquer cidade),
  senão "Informe o município.".
- `whatsapp`: `normalizarWhatsapp` e então casar `^\d{12,13}$`, senão
  "WhatsApp inválido — use DDD + número.".
- OK → `valido` com `{ nome, categoria, oQueVende, municipio, whatsapp }` (normalizados).

Regras de `validarDecisaoFornecedor`: corpo objeto; `id` UUID (mesma regex do
`validarDecisao`); `decisao` ∈ {aprovado, rejeitado, removido}.

### `app/api/fornecedores/route.ts` (novo — POST público)

Espelha `app/api/reportar/route.ts`:
- `export const dynamic = 'force-dynamic';`
- `body` inválido → 400 `{erro}`.
- `validarFornecedor`: `honeypot` → 200 `{recebido:true}` (descarta, não educa o bot);
  `invalido` → 400 `{erro}`.
- `ipHash(req)` (sha256 do `x-forwarded-for`, nunca guarda IP puro).
- **Limite 3/IP/24h**: conta `fornecedores` com `ip_hash` = hash e `criado_em >= agora-24h`;
  erro → 500; `>= 3` → 429 "Limite diário atingido — tente amanhã.".
- `insert({ ...fornecedor(snake_case), ip_hash })` (status default `pendente`); erro → 500.
- OK → 200 `{recebido:true}`.

Mapeamento camel→snake no insert: `o_que_vende: fornecedor.oQueVende` (os demais já batem).

### `app/api/moderar/fornecedor/route.ts` (novo — POST, cookie da mesma senha)

Espelha `app/api/moderar/decidir/route.ts`:
- Sessão: `lerTokenDoCookie` + `verificarToken(token, Date.now(), MODERACAO_SENHA)`;
  inválida → 401.
- `body` inválido → 400; `validarDecisaoFornecedor` inválido → 400.
- Status de origem exigido conforme a decisão (sem TOCTOU):
  - `aprovado`/`rejeitado` só a partir de `pendente`.
  - `removido` só a partir de `aprovado`.
- `update({ status: decisao }).eq('id', id).eq('status', origemExigida).select('id')`.
- erro → 500; `data` vazio → 404 "Fornecedor não encontrado ou já resolvido."; OK → 200 `{ok:true}`.

### `components/FormAnuncioFornecedor.tsx` (novo — client)

Espelha `FormReporte`: campos nome, categoria (`<select>` das `CATEGORIAS`), o que
vende, município, WhatsApp, mais o honeypot `contato` (escondido). `POST /api/fornecedores`;
estados enviando/erro/sucesso ("Recebido! Vai ao ar depois da conferência."). Mensagens
de erro do corpo da resposta.

### `app/fornecedores/anunciar/page.tsx` (novo)

Página com o `FormAnuncioFornecedor` e um texto curto ("Anuncie sua empresa na praça —
entra depois de uma conferência rápida."). Link de volta pra `/fornecedores`.

### `app/fornecedores/page.tsx` (modificar)

- Vira `force-dynamic`; lê aprovados do banco:
  `createPublicClient().from('fornecedores').select('nome, categoria, o_que_vende, municipio, whatsapp').eq('status','aprovado').order('nome')`
  (a RLS já limita a aprovados; o `.eq` é defesa em profundidade + clareza).
- Mapeia `o_que_vende → oQueVende` para o tipo `Fornecedor` e passa à `VitrineFornecedores`.
- Adiciona um CTA "Você atende a praça? **Anuncie aqui**" → `/fornecedores/anunciar`.
- Falha de leitura → a vitrine mostra o estado "em breve" (lista vazia), sem quebrar.

### `components/AbasModeracao.tsx` (novo — client) + `app/moderar/page.tsx` (modificar)

- `AbasModeracao` é um wrapper leve com duas abas ("Preços" | "Fornecedores") que
  alterna qual fila mostra (estado local `useState`). Recebe os dois conjuntos já
  resolvidos e renderiza `FilaModeracao` ou `FilaFornecedores`.
- `/moderar` (server) passa a buscar também os fornecedores via service role:
  pendentes (`status='pendente'`) e aprovados (`status='aprovado'`), ordenados por
  `criado_em desc` / `nome`. Monta os view-models e entrega ao `AbasModeracao`.

### `components/FilaFornecedores.tsx` (novo — client)

Espelha `FilaModeracao`: seção "Esperando decisão" (cards com nome/categoria/município/
o que vende/WhatsApp + Aprovar/Rejeitar) e seção "No ar" (cards aprovados + Remover).
Cada ação → `POST /api/moderar/fornecedor`; remoção otimista da lista, devolvendo só o
card cuja decisão falhou (igual `FilaModeracao`).

## Fluxo de dados

```
Fornecedor → FormAnuncioFornecedor → POST /api/fornecedores → insert pendente
Dono → /moderar (aba Fornecedores) → FilaFornecedores → POST /api/moderar/fornecedor → update status
Público → /fornecedores → public client (RLS: só aprovado) → VitrineFornecedores
```

## Tratamento de erros

| Situação | Resposta |
|---|---|
| Corpo inválido (submissão) | 400 `{erro:'Envio inválido.'}` |
| Honeypot preenchido | 200 `{recebido:true}` (descarta) |
| Campo inválido | 400 `{erro}` específico |
| Limite 3/IP/24h | 429 |
| Erro de banco (submissão) | 500 |
| Moderação sem sessão | 401 |
| Decisão inválida | 400 |
| Nada mudou (id/status) | 404 |
| Erro de banco (moderação) | 500 |
| Falha ao ler a vitrine | vitrine "em breve" (vazia), 200 |

## Testes

- `normalizarWhatsapp`: `(94) 99999-8888` → `5594999998888`; já com 55 mantém; lixo não-numérico some.
- `validarFornecedor`: válido; honeypot; cada campo inválido (nome curto, categoria fora
  da lista, o que vende vazio, município curto, whatsapp fora de `^\d{12,13}$`); trims.
- `validarDecisaoFornecedor`: aprovado/rejeitado/removido válidos; id não-UUID → inválido;
  decisão desconhecida → inválido.
- `POST /api/fornecedores`: honeypot→200 sem insert; inválido→400; 429 no limite;
  caminho feliz insere `pendente` com `o_que_vende` e `ip_hash`; erro→500 (supabase mockado).
- `POST /api/moderar/fornecedor`: 401 sem cookie válido; 400 inválido; aprovar exige
  `status='pendente'`, remover exige `status='aprovado'` (assere o `.eq('status', ...)`);
  404 quando `data` vazio; 500 em erro.
- `FormAnuncioFornecedor`: envia os campos certos, mostra sucesso; erro do servidor aparece.
- `FilaFornecedores`: renderiza pendentes e aprovados; ações chamam a rota; remoção otimista.
- `agruparPorCategoria` (já existe) segue verde com dados vindos do banco.
- Invariante do WhatsApp preservado (`^\d{12,13}$`).

## Segurança e privacidade

- IP nunca guardado puro — só `ip_hash` (sha256), igual reportes.
- Honeypot + limite por IP contra spam. Pendentes escondidos por RLS (só service role vê).
- Moderação atrás da senha `MODERACAO_SENHA` (cookie HMAC, mesma sessão dos reportes).
- Dados públicos por natureza (contato comercial que o próprio fornecedor divulga); nada
  de PII sensível.

## Fora de escopo (YAGNI — anotado)

- Edição pelo próprio fornecedor (reenvia um novo).
- Upload de logo/foto, e-mail de aviso ao dono, busca por texto, novas categorias.
- Reativar um `removido` pela UI (via dashboard do Supabase, se preciso).
