# Mercado, cartões e chuva — 07/10/2026

## Pedido

Retirar euro, bitcoin e ethereum da aba Mercado; melhorar os cartões de preço e o boletim compartilhado; tornar a chuva mais clara no celular e usar símbolos meteorológicos e de contexto que ajudem a leitura.

## Decisões

- A aba Mercado e as duas versões do boletim mostram só dólar, ouro e Ibovespa. A coleta e o histórico dos três ativos retirados permanecem preservados; esta fatia altera a apresentação.
- O cartão da porteira deixa de chamar preço parado de “0%”. Para o gado, mostra “Estável desde DD/MM” quando a data existe; sem ela, mostra “Estável”. A consulta precisa trazer `variou_em`.
- O boletim compacto ganha hierarquia de fechamento, preços e fonte mais legíveis, sem perder unidade, data, lugar nem crédito. Não exibe um valor incompleto se a consulta falhar.
- Na chuva, a leitura local vem antes do panorama regional. A foto e o texto distinguem a média regional da previsão de uma cidade. As barras dos municípios usam escala declarada da própria semana, e a faixa horizontal indica que há mais dias ao lado.
- Emoji acompanha a informação e o texto continua explícito: 💧 para chuva, 🌡️ para temperatura, 🚜 para a lida; os dias usam símbolo compatível com o volume previsto. Previsão ausente nunca vira “sem chuva”.

## Aceite

- Euro, bitcoin e ethereum não aparecem na aba Mercado nem no card do boletim; dólar, ouro e Ibovespa permanecem.
- Preço parado aparece como estável, com data quando conhecida; valores, unidades, praças e fontes não mudam.
- Chuva local e seus sete dias são legíveis em iPhone 13; ausência de dado local não produz 0 mm ou 0 °C.
- Testes, typecheck, lint, build e auditoria de tela móvel passam antes da publicação.
