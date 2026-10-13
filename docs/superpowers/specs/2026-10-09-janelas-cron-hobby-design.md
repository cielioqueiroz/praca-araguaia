# Janelas da coleta e do fechamento na Vercel Hobby

## Problema

No plano Hobby, a Vercel pode iniciar cada cron em qualquer minuto da hora UTC
escolhida. A configuração nominal anterior colocava a coleta na hora de 17h BRT
(`20:30 UTC`) e o boletim na hora seguinte, 18h BRT (`21:00 UTC`). A coleta
podia começar antes de a Scot publicar e muito perto do início da janela do
boletim. Em 09/10, não houve registro da coleta agendada até 18h01; uma coleta
manual autorizada pelo fluxo operacional atualizou os preços às 18h03.

## Decisão

O dono escolheu mover as janelas: coleta na hora de 18h BRT (`21:00 UTC`) e
boletim na hora de 19h BRT (`22:00 UTC`), apenas em dias úteis. A mudança aumenta
a chance de as fontes estarem publicadas antes da coleta e preserva uma hora de
separação nominal entre as janelas. Uma coleta iniciada no último minuto ainda
pode terminar depois do primeiro minuto da janela seguinte; a rota de envio
continua falhando fechada nesse caso, sem broadcast parcial.

O envio segue único por dia e sessão, e a mudança não liga abertura, alertas
nem resumo de audiência.

## Verificação

Validar `vercel.json`, testes, typecheck, lint e build. Publicar após a janela
do fechamento de 09/10, conferir o SHA e `vercel crons ls`. A primeira execução
automática nas novas janelas precisa de conferência no próximo dia útil.
