-- Preço de cada UF da praça (PA, MT, TO, GO), do mesmo arquivo semanal da CONAB.
-- Substitui a média regional na interface: o produtor vê o preço do estado dele.
-- Sem histórico próprio — a variação semana a semana já vem calculada do arquivo.

create table if not exists cotacoes_uf (
  id bigint generated always as identity primary key,
  tipo text not null,
  uf text not null,
  valor numeric(12,2) not null,
  unidade text not null,
  variacao_pct numeric(6,2),
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now(),
  unique (tipo, uf)
);

alter table cotacoes_uf enable row level security;

-- Leitura pública (o painel usa a anon key); escrita só pela service role, que ignora RLS.
drop policy if exists "leitura publica de cotacoes_uf" on cotacoes_uf;
create policy "leitura publica de cotacoes_uf"
  on cotacoes_uf for select
  to anon, authenticated
  using (true);
