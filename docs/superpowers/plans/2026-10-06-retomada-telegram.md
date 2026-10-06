# Retomada organizada do Telegram — plano

- [x] Criar a migration 0016 para registrar uma entrega por dia e sessão sob RLS.
- [x] Testar a regra de coleta completa para cotações, praças e estados.
- [x] Testar o bloqueio da rota antes de qualquer envio quando a coleta está parcial.
- [x] Testar reserva única: a segunda chamada não envia, inclusive após falha parcial.
- [x] Continuar o envio aos outros chats quando um envio falhar por exceção de rede.
- [x] Agendar somente o fechamento às 18:00 BRT e atualizar documentação operacional.
- [x] Rodar testes, typecheck, lint, build e conferir o cron e o audit. O audit de
  produção está zerado; o audit completo aponta cinco ocorrências de `braces`
  somente na cadeia de lint, sem correção disponível nesta major.
- [ ] Aplicar migration, publicar e verificar o commit em produção antes de chamar
  qualquer rota de prévia ou disparo.
- [ ] Observar a primeira entrega pelo registro de envio e pelos logs.
