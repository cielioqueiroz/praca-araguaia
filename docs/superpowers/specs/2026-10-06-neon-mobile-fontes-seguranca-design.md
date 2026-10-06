# Neon, boletim compacto e informação útil no celular

## Problema

O banco em produção ainda é o Supabase. O dono quer o Neon, o boletim entregue no Telegram em formato menor e uma primeira dobra útil no celular. A revisão encontrou ainda: ticker com referência regional sem lugar nomeado, notícias antigas que podem reaparecer quando outros feeds falham e login que aceitava a senha mesmo se a gravação da tentativa falhasse.

## Comportamento esperado

- A troca de banco preserva todas as linhas, inclusive assinantes e reservas do boletim. A leitura pública usa um usuário SQL só de leitura com RLS para reportes e fornecedores aprovados. Escrita só em rotas de servidor.
- A produção muda de provedor apenas em um novo deploy, após a janela do boletim do dia. A origem permanece disponível para comparação e retorno se a verificação falhar.
- O Telegram recebe uma imagem de 1080 × 1200 com uma praça por UF, até dois lugares por produto, crédito e data. O site pode exibir e baixar a mesma versão; a lista completa segue no painel.
- No celular, o preço aparece antes das notícias na home. O ticker informa o lugar de cada preço da porteira, omite dado vencido e trata preço parado como estável.
- Uma matéria com mais de sete dias, sem data ou com data futura não aparece na home. Feed indisponível não derruba a página.
- Segredos e conexões ficam apenas no servidor e fora do Git. Login, cron e bot falham fechados quando seus pré-requisitos não estão disponíveis.

## Limites desta fatia

O histórico agregado da porteira continua sendo uma série regional; a tela a identifica assim e aponta para os preços por lugar. Criar histórico por praça/UF exigirá uma nova tabela e nova coleta. O adaptador PostgREST para Neon é transitório; substituir as consultas por repositórios SQL de domínio fica para fatias futuras, sem misturar a migração de dados com 76 reescritas.

## Aceitação

Testes, typecheck, lint, build, conferência das linhas no Neon e telas iPhone 13 sem rolagem horizontal ou alvos de toque pequenos. Em produção: SHA publicado verificado, páginas e APIs de leitura saudáveis, coleta e reserva do Telegram conferidas sem provocar broadcast duplicado.
