-- POR QUE ISTO EXISTE: a série de cotacoes_historico agrega a região e não é o
-- preço de praça/UF. O novo histórico registra só preços publicados por lugar.
create table cotacoes_lugar_historico (
  id bigint generated always as identity primary key,
  tipo text not null,
  recorte text not null check (recorte in ('praca', 'uf')),
  uf text not null,
  praca text not null default '',
  valor numeric(12,2) not null check (valor > 0),
  unidade text not null,
  fonte text not null,
  data_referencia timestamptz not null,
  criado_em timestamptz not null default now(),
  constraint cotacoes_lugar_chave unique (tipo, recorte, uf, praca, data_referencia),
  constraint cotacoes_lugar_recorte check (
    (recorte = 'uf' and praca = '') or (recorte = 'praca' and praca <> '')
  )
);
create index cotacoes_lugar_busca on cotacoes_lugar_historico
  (tipo, recorte, uf, praca, data_referencia desc);

alter table cotacoes_lugar_historico enable row level security;
create policy historico_lugar_leitura on cotacoes_lugar_historico
  for select to praca_leitura using (true);
grant select on cotacoes_lugar_historico to praca_leitura;

-- O retrato atual é um ponto real, com a própria data da fonte. Não se geram
-- pontos diários artificiais para preços que ficaram parados.
insert into cotacoes_lugar_historico
  (tipo, recorte, uf, praca, valor, unidade, fonte, data_referencia)
select tipo, 'praca', uf, praca, valor, unidade, 'scot', data_referencia
from cotacoes_praca;

insert into cotacoes_lugar_historico
  (tipo, recorte, uf, praca, valor, unidade, fonte, data_referencia)
select tipo, 'uf', uf, '', valor, unidade,
  case when tipo in ('soja', 'milho', 'boi') then 'conab' else 'scot' end,
  data_referencia
from cotacoes_uf;
