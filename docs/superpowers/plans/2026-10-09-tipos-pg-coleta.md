# Plano: normalizar a leitura do PostgreSQL

1. Adicionar testes de contrato com `numeric` em texto e `timestamptz` em `Date`.
2. Normalizar as leituras em cotações, histórico e assinantes na fronteira SQL.
3. Rodar a suíte, typecheck, lint e build.
4. Publicar, conferir SHA e páginas públicas; observar a coleta e o boletim
   agendados sem dispará-los manualmente.
