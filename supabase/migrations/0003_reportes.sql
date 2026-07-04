-- Termômetro da Praça: reportes anônimos de preço local, moderados manualmente.
create table reportes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (produto in ('boi', 'bezerro', 'vaca', 'soja', 'milho')),
  municipio text not null,
  valor numeric not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  ip_hash text,
  criado_em timestamptz not null default now()
);

create index reportes_aprovados_recentes on reportes (status, criado_em desc);
create index reportes_ip_recentes on reportes (ip_hash, criado_em desc);

alter table reportes enable row level security;

-- Público só enxerga aprovados; escrita apenas via service role (sem policy de insert/update).
create policy "leitura publica de aprovados" on reportes
  for select using (status = 'aprovado');
