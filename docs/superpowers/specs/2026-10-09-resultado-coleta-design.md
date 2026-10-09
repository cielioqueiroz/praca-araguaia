# Resultado verificável da coleta diária

## Problema

A rota `/api/coletar` continua gravando os tipos independentes quando uma fonte falha,
mas responde 200 se ao menos uma cotação entrou. Uma leitura por UF ou praça que devolve
uma lista vazia também aparece como sucesso, embora não atualize preço algum. O cron
pode parecer bem-sucedido até o boletim recusar uma coleta incompleta mais tarde.

## Decisão

- Manter a coleta independente por tipo: uma falha não descarta o que já foi salvo.
- Tratar lista vazia de UF ou praça como falha daquele tipo, sem chamar o repositório.
- Responder 200 só quando não houver falha; 503 para coleta parcial e 502 quando
  nenhuma cotação principal foi obtida. O corpo continua trazendo os resultados e
  erros por tipo para diagnóstico.
- O resumo estruturado registra o status HTTP e os tipos que falharam, sem valores
  de preços ou credenciais.

## Verificação

Cobrir sucesso, falha parcial e lista vazia nos testes da rota; executar suíte,
typecheck, lint e build. Verificar o deploy e acompanhar a próxima execução agendada.
