# Plano — histórico por praça e UF

1. Migration aditiva no Neon com RLS de leitura e seed do retrato atual. Aplicar e conferir contagem sem modificar as tabelas antigas.
2. Testar e implementar gravação idempotente dos pontos ao coletar preços por UF e praça.
3. Extrair a série semanal por UF da CONAB e preencher os últimos 90 dias por rota autenticada, sem broadcast.
4. Trocar o gráfico da porteira por um seletor de lugar e sua série, mantendo o gráfico anterior apenas para Mercado e retorno temporário ao banco antigo.
5. Testes, typecheck, lint, build, auditoria móvel, deploy e conferência de dados reais.
