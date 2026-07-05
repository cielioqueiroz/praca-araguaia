-- Inscritos do bot de Telegram: só o chat_id, escrito pelo webhook (service role).
create table assinantes_telegram (
  chat_id bigint primary key,
  criado_em timestamptz not null default now()
);

alter table assinantes_telegram enable row level security;
-- Sem policy: nega tudo por padrão. Só o service role (webhook) acessa.
revoke all on assinantes_telegram from anon, authenticated;
