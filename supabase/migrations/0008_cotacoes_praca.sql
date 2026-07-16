-- Preço por PRAÇA (fatia 17) — um degrau mais fino que a UF.
--
-- A CONAB dá um preço por estado; a Scot pesquisa a praça: Marabá, Redenção e
-- Paragominas são linhas distintas e têm preços distintos. "O preço do Pará" não é
-- o preço de ninguém — é aqui que o produtor do Araguaia se reconhece.
--
-- Sem histórico próprio, igual à cotacoes_uf: o gráfico de /cotacao/[tipo] segue
-- usando a série regional de cotacoes_historico.

create table if not exists cotacoes_praca (
  id bigint generated always as identity primary key,
  tipo text not null,
  praca text not null,
  uf text not null,
  valor numeric(12,2) not null,
  unidade text not null,
  variacao_pct numeric(6,2),
  -- Só o boi tem: o mesmo preço a prazo de 30 dias, que a Scot publica ao lado.
  valor_prazo numeric(12,2),
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now(),
  unique (tipo, praca, uf)
);

alter table cotacoes_praca enable row level security;

-- Leitura pública (o painel usa a anon key); escrita só pela service role, que ignora RLS.
drop policy if exists "leitura publica de cotacoes_praca" on cotacoes_praca;
create policy "leitura publica de cotacoes_praca"
  on cotacoes_praca for select
  to anon, authenticated
  using (true);
