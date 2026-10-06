# Confiabilidade da chuva e documentação operacional — plano

**Objetivo:** impedir espera indefinida e dados meteorológicos falsos, além de alinhar o
README ao silêncio vigente do Telegram.

**Borda testada:** `buscarPrevisao(fetchImpl?)`, já estabelecida em
`tests/fontes/chuva.test.ts`.

### Tarefa 1: rejeitar temperatura ausente

- [x] Adicionar teste com temperatura `null`.
- [x] Confirmar a falha pelo Vitest.
- [x] Validar números obrigatórios por município e dia.
- [x] Confirmar o teste verde.

### Tarefa 2: limitar a espera da fonte

- [x] Adicionar teste que exige um `AbortSignal` na chamada.
- [x] Confirmar a falha pelo Vitest.
- [x] Aplicar timeout de 8 segundos.
- [x] Confirmar o teste verde.

### Tarefa 3: corrigir documentação

- [x] Atualizar README para informar que boletim e alertas automáticos estão pausados.
- [x] Registrar `TELEGRAM_DONO_CHAT_ID` no exemplo e nos documentos de envs.
- [x] Atualizar o topo do documento de retomada e retirar pendências históricas
  contraditórias da seção vigente.

### Tarefa 4: verificar

- [x] Rodar testes da fonte de chuva.
- [x] Rodar `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
