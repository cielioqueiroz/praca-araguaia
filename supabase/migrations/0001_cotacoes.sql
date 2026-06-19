-- Último valor "vivo" por tipo (1 linha por tipo).
create table cotacoes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null unique,
  valor           numeric(12,4) not null,
  unidade         text not null,
  variacao_pct    numeric(6,2),
  fonte           text not null,
  data_referencia timestamptz not null,
  atualizado_em   timestamptz not null default now()
);

-- Série temporal append-only.
create table cotacoes_historico (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,
  valor           numeric(12,4) not null,
  fonte           text not null,
  data_referencia timestamptz not null,
  created_at      timestamptz not null default now()
);
create index cotacoes_historico_tipo_data_idx
  on cotacoes_historico (tipo, data_referencia desc);

-- RLS: leitura pública, escrita só service role (que ignora RLS).
-- A escrita por anon fica negada por AUSÊNCIA de policy permissiva (RLS nega por
-- padrão). Para defesa em profundidade, revogamos também os GRANTs de tabela do
-- anon/authenticated: assim, mesmo que uma migração futura adicione uma policy
-- permissiva por engano, a escrita continua bloqueada no nível de privilégio.
alter table cotacoes enable row level security;
alter table cotacoes_historico enable row level security;

revoke insert, update, delete on cotacoes from anon, authenticated;
revoke insert, update, delete on cotacoes_historico from anon, authenticated;

create policy "cotacoes leitura publica"
  on cotacoes for select to anon using (true);
create policy "historico leitura publica"
  on cotacoes_historico for select to anon using (true);
