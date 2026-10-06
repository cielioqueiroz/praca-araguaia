# Confiabilidade da chuva e documentação operacional — 06/10/2026

## Problema

A consulta da Open-Meteo não define limite próprio de espera e transforma temperatura
`null` em `0` por coerção numérica. Uma resposta parcial pode, portanto, publicar zero
grau como se fosse previsão válida. Em paralelo, o README ainda afirma que boletim e
alertas chegam diariamente pelo Telegram, embora os crons de envio estejam pausados
desde 19/08/2026 por decisão do dono.

## Decisões

- A borda pública continua sendo `buscarPrevisao(fetchImpl?)`.
- A chamada à Open-Meteo recebe `AbortSignal.timeout(8_000)`, o mesmo limite usado na
  coleta de notícias.
- Chuva e temperaturas obrigatórias precisam ser números finitos em todos os sete dias.
  Probabilidade continua aceitando `null`, porque a fonte realmente a omite em dias
  distantes.
- Resposta incompleta é falha da fonte e sobe como erro; a página já traduz essa falha
  para “previsão indisponível”, sem inventar dado.
- O README passa a separar a capacidade existente do estado operacional: inscrição e
  rotas continuam disponíveis, mas nenhum cron envia mensagem hoje.

## Fora desta fatia

- Persistir o último dado bom da previsão exigiria armazenamento próprio e política de
  validade. Fica para uma fatia separada.
- Os envios do Telegram não serão religados.
- Nenhuma alteração visual.

