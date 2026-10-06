-- A chave por dia e sessão impede que duas execuções do cron enviem o mesmo
-- boletim. A reserva persiste mesmo se o processo cair após um envio parcial:
-- reenvio automático nesse caso duplicaria mensagens para parte dos inscritos.
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

alter table envios_boletim enable row level security;
revoke all on envios_boletim from anon, authenticated;
