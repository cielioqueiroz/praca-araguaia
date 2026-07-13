-- O ouro vinha do gold-api na escala da ONÇA TROY (~R$ 21.000) e era exibido como "/g".
-- A fonte passou a dividir por 31,1034768; converte o que já está gravado para a mesma
-- escala, senão a próxima coleta cria um degrau falso de -96,8% no gráfico e na variação.
-- Guarda de idempotência: a grama nunca passou de R$ 5.000 e a onça nunca ficou abaixo,
-- então rodar de novo não converte duas vezes.

update cotacoes
   set valor = round(valor / 31.1034768, 2),
       unidade = 'R$/g'
 where tipo = 'ouro'
   and valor > 5000;

update cotacoes_historico
   set valor = round(valor / 31.1034768, 2)
 where tipo = 'ouro'
   and valor > 5000;
