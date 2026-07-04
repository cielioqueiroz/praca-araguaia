# Termômetro da Praça — T1: Capturar e Mostrar — Design

> Design doc — 2026-07-03 — Fatia 8 da Praça Araguaia (primeira de três sub-fatias do Termômetro).
> Produtores reportam preços locais anonimamente; reportes aprovados viram média dos últimos 7 dias em `/termometro`. É o diferencial do produto: preço de balcão que nenhuma fonte oficial dá.

## 0. Decomposição do Termômetro (visão geral)

| Sub-fatia | Entrega | Status |
|---|---|---|
| **T1 (esta)** | Form anônimo de reporte + moderação via dashboard do Supabase + página de médias 7d | — |
| T2 | UI de moderação protegida (aprovar/rejeitar da fila, mobile) | futura |
| T3 | Verificação por telefone/WhatsApp (OTP), reputação, mediana/outliers | futura |

**Decisões de produto (validadas com o usuário):** reporte **anônimo com moderação manual** (menor atrito; o ativo escasso é gente reportando); produtos **boi gordo (R$/@), bezerro (R$/cabeça), vaca gorda (R$/@), soja e milho (R$/sc 60kg)** — bezerro e vaca são cobertura que nem a CONAB dá; municípios = **os 5 da página de chuva** (Redenção/PA, Santana do Araguaia/PA, Vila Rica/MT, Confresa/MT, São Félix do Araguaia/MT).

## 1. Dados (migração `supabase/migrations/0003_reportes.sql`)

```sql
create table reportes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (produto in ('boi', 'bezerro', 'vaca', 'soja', 'milho')),
  municipio text not null,
  valor numeric not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  ip_hash text,
  criado_em timestamptz not null default now()
);

alter table reportes enable row level security;
create policy "leitura publica de aprovados" on reportes
  for select using (status = 'aprovado');
-- sem policy de insert/update para anon: escrita só via service role
```

- `ip_hash` = SHA-256 do IP (privacidade — nunca guardar IP puro). Usado só para o limite de envios.
- **Moderação v1:** aprovar/rejeitar direto na tabela pelo dashboard do Supabase (mudar `status`). UI própria fica para a T2.

## 2. Escrita — `POST /api/reportar` (Abordagem A)

Rota Next com **service role**; a tabela não aceita INSERT do público. Corpo JSON: `{ produto, municipio, valor, contato }` (`contato` é o **honeypot** — campo escondido no form; humano não preenche).

Validações no servidor (lógica pura em `lib/termometro.ts`, testável):

| Regra | Comportamento |
|---|---|
| `produto` fora da lista | 400 com mensagem clara |
| `municipio` fora dos 5 | 400 |
| `valor` fora da faixa plausível | 400 apontando a faixa |
| honeypot preenchido | responde **200 como se tivesse aceitado** e descarta (não educa o bot) |
| > **5 reportes por ip_hash em 24h** | 429 "Limite diário atingido — tente amanhã." |
| banco fora | 500 |

Faixas plausíveis (bloqueiam erro de digitação/troll, não a variação real): boi **150–600 R$/@**; vaca **130–550 R$/@**; bezerro **800–6.000 R$/cabeça**; soja **40–300 R$/sc**; milho **20–200 R$/sc**.

IP: `x-forwarded-for` (primeiro item) na Vercel; hash com SHA-256 (`crypto.subtle` ou `node:crypto`).

## 3. Leitura — página `/termometro`

- Consulta (client anon — a RLS só entrega aprovados): reportes com `criado_em >= agora − 7 dias`.
- Agregação em `lib/termometro.ts` (`resumirReportes(reportes) → ResumoProduto[]`): por produto → média regional, contagem total e média+contagem por município (ordem fixa dos municípios). Média simples nesta fatia (mediana/outliers ficam para a T3).
- Exibição por produto (ordem: boi, bezerro, vaca, soja, milho): card no estilo do redesign (papel/linha, número display) com média 7d + "N reportes"; linhas por município quando houver; para boi/soja/milho, linha de contraste "média CONAB: R$ X" (lida de `cotacoes` via anon, mesma consulta do painel).
- Contagem sempre visível ("1 reporte" inclusive) — transparência em vez de esconder amostra pequena.
- Estado vazio: convite "Seja o primeiro a reportar o preço da sua praça" + botão para `/termometro/reportar`.
- `dynamic = 'force-dynamic'` (dado muda a cada aprovação).

## 4. Form — página `/termometro/reportar`

- Mobile-first, 3 campos: produto (select com unidade no rótulo), município (select), valor (input numérico; a unidade do produto selecionado aparece ao lado) + honeypot escondido (`contato`, `display:none` + `tabIndex=-1` + `autocomplete="off"`).
- Client Component (fetch para `/api/reportar`); botão "Enviar preço"; sucesso troca o form por "Recebido! Seu preço entra na média depois de conferido."; erros de validação aparecem junto ao campo; 429 mostra a mensagem do limite.
- Textos em pt-BR simples (público rural, celular).

## 5. Navegação

- Header ganha o item **Termômetro** (`/termometro`); a página de médias tem botão destacado "Reportar preço".

## 6. Testes (TDD)

- `lib/termometro.ts`: validação (produto/município/faixas por produto), honeypot detectado, `resumirReportes` (média regional e por município, contagem, ordem, janela é responsabilidade da query — recebe já filtrado), formatação de unidade por produto.
- `POST /api/reportar` (Supabase mockado): 200 grava pendente com ip_hash; 400s; honeypot → 200 sem gravar; 429 quando count ≥ 5; 500.
- Componentes de exibição: card de produto com média/contagem/municípios; estado vazio.
- Páginas fora dos testes unitários (padrão do projeto); e2e manual na verificação final.

## 7. Critérios de sucesso

1. Produtor envia um preço pelo celular em `/termometro/reportar` sem cadastro; reporte cai como `pendente`.
2. Você aprova no dashboard do Supabase e o valor entra na média 7d em `/termometro` (com contagem e contraste CONAB para boi/soja/milho).
3. Bot que preenche o honeypot não grava nada; 6º reporte do mesmo IP em 24h leva 429.
4. Testes passam; build/lint limpos; migração aplicada no Supabase; deploy na Vercel.
