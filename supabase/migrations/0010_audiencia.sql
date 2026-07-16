-- Quem está acompanhando a praça, por cidade (fatia 18).
--
-- Só cidade, UF e contagem. Nada de IP, nome ou telefone: o dono quer saber que
-- "2 pessoas de Ouricuri-PE estão recebendo", não quem elas são.

-- 1) O Telegram não informa a cidade de quem se inscreve — só o chat_id. A cidade
--    vem do link do convite (t.me/bot?start=<carga>) e é gravada aqui no /start.
--    Nulo para quem já era inscrito antes desta fatia.
alter table assinantes_telegram add column if not exists cidade text;
alter table assinantes_telegram add column if not exists uf text;

-- 2) Acessos ao site, agregados por dia e cidade. Uma linha por (dia, cidade, uf) —
--    nunca uma linha por pessoa.
create table if not exists visitas (
  dia date not null,
  cidade text not null,
  uf text not null,
  acessos int not null default 0,
  primary key (dia, cidade, uf)
);

alter table visitas enable row level security;
-- Sem policy: nega tudo por padrão. Só a service role (a rota /api/visita) escreve,
-- e só o /painel, com senha, lê. Contagem de audiência não é dado público.
revoke all on visitas from anon, authenticated;

-- 3) Incremento atômico. Um select-depois-update perderia contagem quando dois
--    acessos da mesma cidade caem no mesmo instante — e é justamente de manhã, na
--    hora do boletim, que eles caem juntos.
create or replace function registrar_visita(p_dia date, p_cidade text, p_uf text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into visitas (dia, cidade, uf, acessos)
  values (p_dia, p_cidade, p_uf, 1)
  on conflict (dia, cidade, uf)
  do update set acessos = visitas.acessos + 1;
$$;

revoke all on function registrar_visita(date, text, text) from anon, authenticated;
