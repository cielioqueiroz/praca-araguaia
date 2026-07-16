-- A novilha trocou de PRODUTO na fatia 17, não só de fonte.
--
-- Antes: novilha GORDA (Datagro), R$/@ — ~R$ 299.
-- Agora: novilha de REPOSIÇÃO (Scot), R$/cabeça — ~R$ 3.040.
--
-- Não dá para converter, como o ouro da migração 0005 (lá era só dividir a onça por
-- 31,1). Aqui são bichos diferentes vendidos de jeitos diferentes: a novilha gorda
-- vai para o abate por arroba; a de reposição vai para o pasto por cabeça.
--
-- Se estes 3 pontos ficassem, o gráfico de /cotacao/novilha desenharia um salto de
-- +900% entre 15/07 e 16/07 que nunca aconteceu — a mesma mentira que o degrau de
-- -96,8% do ouro teria criado. Apagar é a única leitura honesta.
--
-- Idempotente: só apaga o que está na escala de arroba (< 1000). Rodar de novo
-- depois da coleta nova não toca nos valores por cabeça.

delete from cotacoes_historico where tipo = 'novilha' and valor < 1000;
delete from cotacoes where tipo = 'novilha' and unidade = 'R$/@';
