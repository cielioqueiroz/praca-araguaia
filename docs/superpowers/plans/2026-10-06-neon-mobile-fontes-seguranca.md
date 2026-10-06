# Plano de entrega — Neon, mobile, fontes e segurança

1. Provisionar um projeto Neon e espelhar o esquema público com RLS e papel de leitura. Copiar todas as 11 tabelas, comparar contagem e conteúdo, repetir a cópia imediatamente antes do corte.
2. Introduzir cliente PostgreSQL no servidor por `DATABASE_PROVIDER`, mantendo o caminho antigo disponível para retorno. Validar páginas, ticker, coleta e reserva contra o Neon localmente.
3. Gerar boletim compacto, assinar a URL usada pelo envio, preservar a URL pública fixa e conferir visualmente o PNG. Mostrar a versão compacta na página `/boletim`.
4. Ajustar home, ticker e atualidade das notícias a partir das regras do domínio. Conferir o resultado no iPhone 13.
5. Fechar falhas de segredo ausente, registro de tentativa de login, escrita do webhook e log do broadcast. Inspecionar dependências e arquivos rastreados sem publicar credenciais.
6. Depois da janela de envio do dia, registrar o resultado do cron, sincronizar dados finais, publicar a versão com Neon, conferir SHA e rotas, atualizar a documentação de operação.

**Retorno:** redeploy da última versão com `DATABASE_PROVIDER=supabase` e dados antigos intactos. Antes de voltar, comparar gravações feitas no Neon após o corte; a cópia de ida só pode ser executada antes do corte.
