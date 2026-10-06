# Retomada organizada do Telegram — 06/10/2026

## Objetivo

Retomar uma entrega do boletim por dia útil, às 18:00 BRT, somente na sessão de
fechamento. Alertas de movimento, resumo de audiência e abertura continuam sem cron.
O boletim só sai depois de uma coleta completa no mesmo dia.

## Regras de envio

- A rota exige `CRON_SECRET` e barra fins de semana e feriados nacionais.
- A prévia (`?previa=1&sessao=fechamento`) vai somente ao chat do dono e não ocupa a
  entrega do dia.
- A entrega aos assinantes exige leitura feita hoje de todas as 12 cotações, das
  praças de boi e vaca, e dos estados de novilha, bezerro, soja e milho. O dia é o
  do Araguaia, calculado por `dataLocal()`.
- Se qualquer parte não foi coletada hoje, a rota retorna 503 com os itens faltantes
  e não envia nem reserva a entrega. Uma coleta com erro parcial não deve publicar
  preço velho com legenda de fechamento novo.
- Depois de renderizar a imagem e antes de chamar o Telegram, uma inserção com chave
  única `(dia, sessao)` reserva a entrega. Invocações repetidas ou simultâneas
  retornam sem enviar. A reserva impede duplicatas mesmo se o processo cair após
  enviar a alguns chats; uma falha parcial exige revisão manual antes de reenvio.
- O resultado da entrega fica no banco com contagens e horário de conclusão. Não
  guarda os `chat_id` no registro de envio.
- Falha de rede para um chat não interrompe os demais; bloqueios 403 continuam
  removendo a inscrição.

## Operação

`vercel.json` agenda `/api/coletar` a partir de 17:30 e
`/api/enviar-boletim` a partir de 18:00, de segunda a sexta. A rota assume
`fechamento` quando não recebe a sessão. No plano Hobby, a Vercel pode iniciar
cada cron a qualquer momento dentro da hora agendada. A migration
0016 deve ser aplicada antes do deploy. O deploy precisa ser verificado pelo SHA antes
de qualquer prévia ou disparo manual. A primeira entrega automática é observada
pelos logs e pelo registro de envio.
