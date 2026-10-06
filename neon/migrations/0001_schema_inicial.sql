-- Estado final do esquema público do Supabase, sem objetos internos do provedor.
-- Cada alteração posterior deve vir em outro arquivo numerado.

create table cotacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique,
  valor numeric(12,4) not null,
  unidade text not null,
  variacao_pct numeric(6,2),
  fonte text not null,
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now()
);

create table cotacoes_historico (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  valor numeric(12,4) not null,
  fonte text not null,
  data_referencia timestamptz not null,
  created_at timestamptz not null default now(),
  constraint cotacoes_historico_tipo_data_unq unique (tipo, data_referencia)
);
create index cotacoes_historico_tipo_data_idx on cotacoes_historico (tipo, data_referencia desc);

create table cotacoes_uf (
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

create table cotacoes_praca (
  id bigint generated always as identity primary key,
  tipo text not null,
  praca text not null,
  uf text not null,
  valor numeric(12,2) not null,
  unidade text not null,
  variacao_pct numeric(6,2),
  valor_prazo numeric(12,2),
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now(),
  variou_em timestamptz,
  unique (tipo, praca, uf)
);

create table reportes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (produto in ('boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho')),
  municipio text not null,
  valor numeric not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  ip_hash text,
  criado_em timestamptz not null default now(),
  origem text not null default 'produtor' check (origem in ('produtor', 'praca'))
);
create index reportes_aprovados_recentes on reportes (status, criado_em desc);
create index reportes_ip_recentes on reportes (ip_hash, criado_em desc);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  o_que_vende text not null,
  municipio text not null,
  whatsapp text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'removido')),
  ip_hash text,
  criado_em timestamptz not null default now()
);
create index fornecedores_ip_recentes on fornecedores (ip_hash, criado_em desc);

create table assinantes_telegram (
  chat_id bigint primary key,
  criado_em timestamptz not null default now(),
  cidade text,
  uf text
);

create table visitas (
  dia date not null,
  cidade text not null,
  uf text not null,
  acessos integer not null default 0,
  primary key (dia, cidade, uf)
);

create table tentativas_login (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  criado_em timestamptz not null default now()
);
create index tentativas_login_busca on tentativas_login (ip_hash, criado_em desc);

create table alertas_enviados (
  tipo text not null,
  data_referencia date not null,
  variacao_pct numeric not null,
  enviado_em timestamptz not null default now(),
  primary key (tipo, data_referencia)
);

create table envios_boletim (
  dia date not null,
  sessao text not null check (sessao in ('abertura', 'fechamento')),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  enviados integer check (enviados >= 0),
  removidos integer check (removidos >= 0),
  falhas integer check (falhas >= 0),
  primary key (dia, sessao)
);

-- Uma conexão só de leitura dá às páginas públicas um limite no próprio banco.
-- O dono das tabelas escreve apenas em rotas server-side autorizadas.
alter table cotacoes enable row level security;
alter table cotacoes_historico enable row level security;
alter table cotacoes_uf enable row level security;
alter table cotacoes_praca enable row level security;
alter table reportes enable row level security;
alter table fornecedores enable row level security;
alter table assinantes_telegram enable row level security;
alter table visitas enable row level security;
alter table tentativas_login enable row level security;
alter table alertas_enviados enable row level security;
alter table envios_boletim enable row level security;

create policy cotacoes_leitura on cotacoes for select to praca_leitura using (true);
create policy historico_leitura on cotacoes_historico for select to praca_leitura using (true);
create policy uf_leitura on cotacoes_uf for select to praca_leitura using (true);
create policy praca_leitura_publica on cotacoes_praca for select to praca_leitura using (true);
create policy reportes_aprovados_leitura on reportes for select to praca_leitura using (status = 'aprovado');
create policy fornecedores_aprovados_leitura on fornecedores for select to praca_leitura using (status = 'aprovado');

grant usage on schema public to praca_leitura;
grant select on cotacoes, cotacoes_historico, cotacoes_uf, cotacoes_praca, reportes, fornecedores to praca_leitura;

create or replace function registrar_visita(p_dia date, p_cidade text, p_uf text)
returns void language sql security definer set search_path = public as $$
  insert into visitas (dia, cidade, uf, acessos)
  values (p_dia, p_cidade, p_uf, 1)
  on conflict (dia, cidade, uf)
  do update set acessos = visitas.acessos + 1;
$$;
revoke all on function registrar_visita(date, text, text) from public;
