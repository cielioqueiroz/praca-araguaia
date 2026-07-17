-- Freio de força bruta no login da moderação (/moderar e /painel).
--
-- A espera fixa de 800 ms atrasa, mas não trava: são ~100 tentativas por minuto,
-- para sempre, contra uma senha só — a mesma que abre a fila de moderação e o painel
-- de audiência. Falta um contador, e ele precisa sobreviver ao serverless: contar em
-- memória seria contar em cada instância separada, ou seja, não contar.
create table if not exists tentativas_login (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  criado_em timestamptz not null default now()
);

-- A consulta é sempre "quantas deste ip_hash desde tal hora".
create index if not exists tentativas_login_busca on tentativas_login (ip_hash, criado_em desc);

alter table tentativas_login enable row level security;
-- Sem policy: nega tudo por padrão. Só a service role (a rota de login) escreve e lê.
revoke all on tentativas_login from anon, authenticated;
