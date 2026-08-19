-- Desde quando o preço desta praça está parado.
--
-- O card do boi mostrava OITO linhas seguidas de "– 0%": está correto (o preço não
-- mudou mesmo, gado é preço grudento), mas de relance parece sistema travado — e
-- "parece congelado" já foi a queixa do dono uma vez, em julho. Com esta coluna a
-- linha passa a dizer "estável desde 14/08", que informa em vez de assustar.
--
-- Não dá para deduzir do que existe: cotacoes_praca guarda só o estado atual, e não
-- há histórico por praça. Então a data é carregada adiante a cada coleta.
--
-- Nas linhas que já existem começa nula, e a primeira coleta a preenche com o
-- fechamento corrente — que é um piso verdadeiro (o preço JÁ era esse naquele dia),
-- nunca uma data inventada. Ela só subestima a duração, e se corrige sozinha.

alter table cotacoes_praca add column if not exists variou_em timestamptz;

comment on column cotacoes_praca.variou_em is
  'data_referencia da ultima vez que o valor MUDOU; carregada adiante quando repete';
