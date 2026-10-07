# Revisão de fontes, interface, arquitetura e segurança — 06/10/2026

## Informação que faz sentido para o produto

O eixo do site é a porteira: gado por praça da Scot (via Notícias Agrícolas), grãos por UF da CONAB e reportes moderados. Dólar, euro, ouro e bolsa ajudam a entender o contexto; cripto deve permanecer secundária. Oito praças de gado e os estados vizinhos continuam nomeados, sem converter referência regional em preço de uma cidade. O ticker agora seleciona o boi de Redenção/PA (ou nomeia a praça do PA usada), soja e milho do PA e dólar, com validade do dado.

As oito fontes RSS ativas têm filtro de relevância, deduplicação e limite por veículo. O feed do Compre Rural saiu após erro 403 registrado no runtime da Vercel em 06/10. A home passa a rejeitar notícia sem data ou com mais de sete dias. A presença de uma fonte no cadastro não garante que ela responda hoje; os erros são registrados e a página mostra um estado vazio se todas falharem. A melhoria seguinte é medir, por veículo, quantas matérias recentes e relevantes chegam de fato antes de acrescentar novos feeds.

## Interface e design system

Tokens de terra, três famílias tipográficas e componentes por alcance de uso já dão consistência. Na primeira dobra do iPhone, o painel de preço agora vem antes da manchete de notícias; a página do boletim mostra o mesmo formato compacto que vai ao Telegram. O teste de telas usa emulação iPhone 13 e verifica largura e toque. A folha `app/globals.css` reúne estilos de muitas rotas: separar estilos por componente/rota gradualmente melhora manutenção sem trocar a identidade visual.

## Arquitetura

Fonte por arquivo no registry, regras puras em `lib/`, UI perto de seus consumidores e rotas de I/O no App Router formam uma base clara. A migração para Neon usa um adaptador temporário para preservar as consultas existentes; ele deve ceder lugar a repositórios SQL por domínio, começando pelos fluxos com transação (reserva do boletim, moderação e coleta). O gráfico da porteira ainda guarda uma série regional agregada; histórico por praça/UF é a evolução correta para mostrar tendência local de verdade.

## Segurança verificada

- Clientes de leitura usam papel PostgreSQL sem escrita pela conexão pooled; RLS só expõe reportes e fornecedores aprovados. A conexão foi testada com acesso às cotações e recusa à tabela de inscritos. Segredos ficam em variáveis de servidor e `.env.local` ignorado pelo Git.
- Cron usa comparação em tempo constante e nega acesso sem segredo. O card público aceita só duas URLs fixas; parâmetros dinâmicos exigem assinatura para impedir cache misses ilimitados.
- Login agora recusa acesso se não conseguir consultar **ou gravar** a tentativa. O webhook recusa confirmar a inscrição quando a gravação falha. Logs de broadcast não incluem chat ID nem erro de rede que possa trazer o token.
- A busca de `og:image` só visita domínios dos veículos cadastrados e não acompanha redirecionamento. O link de uma matéria vem do RSS externo e antes poderia induzir uma busca do servidor a um endereço interno.
- A imagem do boletim agora retorna erro se qualquer leitura de preço ou reporte falhar; um card incompleto não pode ser transmitido como boletim válido.
- `npm audit --omit=dev` retornou zero. O audit completo ainda mostra cinco alertas altos na cadeia de desenvolvimento do ESLint (`braces` → `micromatch` → `fast-glob`), sem correção disponível na versão atual; não há dependência de produção afetada. Uma troca forçada de major do Next não foi aplicada.

## Pendências priorizadas

1. Conferir o primeiro fechamento automático já em Neon, após a janela de 07/10, sem repetir o envio se houver falha parcial. O fechamento de 06/10 e o deploy do corte foram verificados.
2. Ampliar a observabilidade dos feeds com número de itens recentes e relevantes por veículo. A coleta e o envio já registram totais finais sem chat IDs ou valores de preço.
3. Registrar histórico por praça/UF para substituir a série regional agregada no gráfico.
4. Migrar o adaptador temporário para repositórios SQL por domínio e reduzir a dependência do SDK Supabase.
5. Avaliar uma política CSP compatível com Next, imagens externas e o card gerado; testar em modo report-only antes de impor bloqueios.

**Limite da auditoria:** análise manual do código, testes, build, comparação de dados e varredura de dependências. O Strix não rodou neste ambiente por falta de Docker ativo e credenciais da ferramenta; nenhum pentest automatizado foi alegado.
