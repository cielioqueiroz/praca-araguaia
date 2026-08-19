-- De quem é a testemunha do preço.
--
-- O Termômetro passou 6 semanas no ar com ZERO reportes: self-service sem público
-- não se popula sozinho. A partida é o cold start do conceito (§9) — ligar para
-- produtor e agropecuária conhecidos e lançar os primeiros preços por eles.
--
-- Só que um preço apurado por nós NÃO é um reporte anônimo de quem vendeu, e as duas
-- coisas não podem sair iguais na tela. Daí a coluna:
--
--   'produtor' — chegou pelo formulário público, anônimo (o padrão, e o que existe hoje).
--   'praca'    — a Praça Araguaia apurou e lançou pela moderação, assinando por ele.
--
-- Ver docs/adr/0003-reporte-apurado-pela-praca.md. Número inventado não entra em
-- origem nenhuma.

alter table reportes
  add column if not exists origem text not null default 'produtor';

alter table reportes drop constraint if exists reportes_origem_check;
alter table reportes
  add constraint reportes_origem_check check (origem in ('produtor', 'praca'));

comment on column reportes.origem is
  'produtor = formulário público anônimo; praca = apurado pela Praça e lançado na moderação';
