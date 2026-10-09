# Plano: repositórios SQL do Neon

1. Expor o pool existente sem duplicar conexões nem alterar RLS.
2. Implementar a coleta com transações e as mesmas regras puras de variação,
   data da última mudança, histórico idempotente e remoção de praças ausentes.
3. Implementar leitura da coleta, reserva, resultado e lista do boletim em SQL.
4. Implementar as decisões de moderação com condição atômica de estado.
5. Ligar as rotas aos repositórios no provedor Neon, mantendo o retorno Supabase.
6. Testar rollback, repetição, estados concorrentes, suíte e build; publicar e
   confirmar o deployment antes da janela dos crons.
