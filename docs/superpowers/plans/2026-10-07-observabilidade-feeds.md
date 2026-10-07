# Plano — observabilidade dos feeds

1. Extrair uma função pura que conte itens colhidos, recentes e relevantes por feed, usando as regras já existentes de data e classificação.
2. Testar os limites: notícia antiga, sem data, relevante, irrelevante e leitura que falhou.
3. Integrar uma linha estruturada em `buscarNoticias`, mantendo os erros individuais e a seleção atual da home.
4. Rodar os gates do repositório, publicar e confirmar o deployment. Observar logs futuros antes de remover ou acrescentar feeds.
