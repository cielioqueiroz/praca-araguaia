-- O Termômetro passa a cobrir as 6 categorias da porteira (antes: 5, sem novilha).
-- O CHECK antigo recusaria um reporte de novilha no banco, mesmo o app aceitando.

alter table reportes drop constraint if exists reportes_produto_check;

alter table reportes
  add constraint reportes_produto_check
  check (produto in ('boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho'));
