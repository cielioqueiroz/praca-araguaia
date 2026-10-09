# Plano: resultado verificável da coleta

1. Atualizar os testes da rota para exigir 503 em falha parcial e para rejeitar
   listas vazias de UF e praça sem gravá-las.
2. Implementar a validação local de cada lote e o status final, preservando a
   independência das fontes e o corpo da resposta.
3. Rodar testes, typecheck, lint e build.
4. Publicar, verificar o SHA e as rotas públicas e conferir a execução agendada
   de 09/10 sem acionar coleta ou envio manualmente.
