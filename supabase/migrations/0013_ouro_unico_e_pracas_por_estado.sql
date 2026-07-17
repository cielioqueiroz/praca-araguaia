-- Duas limpezas a pedido do dono (17/07/2026).

-- 1) O "ouro 18k" saiu do Mercado — fica só o Ouro (grama fino, R$/g). Apaga o tipo
--    do preço atual e do histórico; a coleta não grava mais 'ouro18k'.
delete from cotacoes where tipo = 'ouro18k';
delete from cotacoes_historico where tipo = 'ouro18k';

-- 2) Boi e vaca passaram a mostrar UMA praça de referência por estado (Mato Grosso,
--    Tocantins, Goiás, Bahia, Maranhão), além das três cidades do Pará. As praças
--    antigas (MT Sudeste, TO Sul, BA Sul…) ficariam órfãs em cotacoes_praca — o
--    upsert só grava o que chega, nunca apaga o que saiu. Limpo aqui; a próxima
--    coleta reescreve as vivas. As praças que ficam usam o NOME DO ESTADO como
--    'praca' (é assim que a Scot agora entrega), então basta manter essas.
delete from cotacoes_praca
where tipo in ('boi', 'vaca')
  and praca not in ('Marabá', 'Paragominas', 'Redenção', 'Mato Grosso', 'Tocantins', 'Goiás', 'Bahia', 'Maranhão');
