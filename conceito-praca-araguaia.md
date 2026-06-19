# Praça Araguaia — Documento de Conceito

> Nome de trabalho provisório. Plataforma hiperlocal de cotações e mercado agropecuário para a região do Araguaia (sul do PA / nordeste do MT).

---

## 1. Visão em uma frase

Ser **a fonte diária de informação do produtor rural da região do Araguaia**: cotações que importam, atualizadas todo dia, mais um termômetro da praça local que ninguém mais entrega — e, em cima disso, uma vitrine de insumos e fornecedores com contato direto no WhatsApp.

## 2. O problema

O produtor da região decide compra e venda (boi, grão, insumo) com base em informação picada, espalhada em WhatsApp e ligação. Cotação nacional existe de monte, mas o que vale é o **preço da praça daqui** — quanto o frigorífico local está pagando, o ágio do bezerro na região — e isso não está centralizado em lugar nenhum para o sul do Pará.

## 3. Público-alvo

- **Primário:** pecuaristas de corte (recria e engorda) e agricultores de grãos da região.
- **Secundário (lado pagante):** agropecuárias, revendas de insumo, leiloeiros, fornecedores de sal mineral e nutrição animal.

## 4. Estratégia de dados (o ponto mais importante do projeto)

Os dados se dividem em três baldes, e cada um tem um tratamento diferente. **Não misturar isso é o que separa um projeto sério de um problema legal.**

### 4.1. Automatizável — referência de mercado (enche o sistema sozinho)
Fontes públicas/primárias, puxadas por scraping agendado (Firecrawl) ou API:
- **CEPEA/ESALQ** — indicadores de boi gordo, bezerro, soja, milho. *Atenção:* há direitos sobre os indicadores; verificar termos antes de uso comercial / monetização.
- **B3** — futuros de boi gordo, milho, soja (mercado em tempo real de verdade).
- **IMEA** — preços regionais de MT (relevante pela proximidade geográfica).
- **CONAB** — preços oficiais de referência.
- **Câmbio (dólar)** e **ouro** — APIs financeiras, tempo real, fáceis.
- **Clima/chuva** — Open-Meteo / INMET, gratuito, por município.

### 4.2. Crowdsourced — Termômetro da Praça (o diferencial / o fosso)
O preço local não existe em fonte nenhuma. Produtores que venderam **reportam de forma anônima**: quanto pegaram na arroba, em qual frigorífico, com qual prazo. O sistema mostra a **média da semana** e a faixa de preço relatada.
- Publicar **sempre** como "preço relatado por produtores", nunca como tabela oficial de frigorífico.
- Isso protege juridicamente, cria comunidade e entrega o que ninguém mais tem.

### 4.3. Proibido — dado proprietário de terceiros
Não raspar nem republicar dados de serviços pagos/proprietários (ex.: Scot Consultoria). É o produto comercial deles. Se quiser esse dado, o caminho é **licenciar/parceria oficial**.

## 5. Funcionalidades por fase

### MVP (Fase 1) — o que faz bombar
- Painel de cotações de referência: boi gordo, vaca, novilha, boi China, bezerro, soja, milho (+ dólar e ouro).
- Histórico e gráfico de tendência (subindo/caindo) — principal gancho de retorno.
- **Termômetro da Praça** (reporte anônimo + média semanal).
- Boletim diário automático: card gerado (Satori) para postar no Instagram e disparar no WhatsApp.
- Previsão de chuva por município.

### Fase 2 — utilidade e marketplace
- **Relações de poder de troca:** boi × saca de milho (custo de engorda), boi × bezerro (margem de recria), boi × dólar, boi × ouro.
- **Calculadora de venda:** quantidade × peso × preço, com desconto de Funrural, frete e comissão → líquido a receber.
- **Alertas no WhatsApp:** "me avise quando a arroba passar de R$ X".
- **Vitrine de insumos e sal mineral:** preço comparado entre fornecedores + botão direto pro WhatsApp (`wa.me`). O fornecedor mantém o próprio preço (ele *quer* aparecer).
- **Agenda de leilões** da região.

### Fase 3 — comunidade e escala
- Classificados (vende boi, compra bezerro, vende máquina, arrenda pasto).
- Bot de WhatsApp/Telegram para reporte de preço e recebimento do boletim.
- Plano premium (histórico completo, alertas avançados).

## 6. Modelo de dados (rascunho — Supabase / PostgreSQL)

```
cotacoes
  id, tipo (boi_gordo|vaca|novilha|boi_china|bezerro|soja|milho|dolar|ouro),
  valor, unidade (@|saca|R$), fonte (cepea|b3|imea|conab|cambio),
  regiao, data_referencia, created_at

cotacoes_historico  -- série temporal para os gráficos
  id, tipo, valor, regiao, data

reportes_praca  -- Termômetro da Praça (crowdsourced, anônimo)
  id, categoria, valor_arroba, frigorifico, prazo_dias,
  municipio, status (pendente|aprovado), created_at
  -- agregação semanal calculada via view/materialized view

fornecedores
  id, nome, categoria (insumo|sal_mineral|nutricao|maquina),
  whatsapp, instagram, site, cidade, destaque (bool), ativo (bool)

produtos
  id, fornecedor_id, nome, preco, unidade, atualizado_em

leiloes
  id, titulo, data, local, leiloeiro, link, regiao

usuarios  -- auth via Supabase (telefone/WhatsApp)
  id, nome, municipio, perfil (produtor|fornecedor|admin)

alertas
  id, usuario_id, tipo_cotacao, condicao (acima|abaixo), valor_alvo
```

> Aplicar **RLS** desde o início: reporte de praça entra como `pendente` e só aparece após moderação; fornecedor só edita os próprios produtos.

## 7. Stack técnica

- **Front + back:** Next.js 15 (App Router) + TypeScript + Tailwind.
- **Banco / Auth / Storage:** Supabase (auth por telefone/WhatsApp).
- **Coleta automatizada:** Firecrawl (scraping agendado de fontes públicas) + cron (Vercel Cron ou GitHub Actions).
- **Cards do boletim:** Satori / `@vercel/og` para gerar a imagem do Instagram.
- **APIs externas:** Open-Meteo (clima), API de câmbio/ouro.
- **Deploy:** Vercel (ou Hostinger, conforme preferência).

## 8. Fluxo do Termômetro da Praça

1. Produtor abre o reporte (formulário curto): categoria, valor da arroba, frigorífico, prazo, município.
2. Entra como `pendente`.
3. Moderação (você no começo; depois reputação/automação) aprova ou descarta outliers.
4. Uma `materialized view` recalcula a média e a faixa da semana por categoria/município.
5. Painel mostra: "Boi gordo na região — relatado por produtores: R$ X a R$ Y (média R$ Z) nesta semana".

## 9. Como dar a partida (cold start)

- Começar pela própria rede (vizinhos de fazenda, sindicato rural, agropecuária, leiloeiro).
- Dar valor antes de pedir cadastro: boletim diário grátis vira hábito → hábito vira audiência.
- Parceria com quem já tem público local (incluindo o perfil de Instagram que já bomba na cidade).

## 10. Monetização (depois da audiência)

- Agropecuária e revenda de insumo: destaque/anúncio na vitrine.
- Leiloeiro: divulgação de leilão.
- Classificado pago.
- Plano premium (histórico/alertas).
> O dinheiro vem do lado B2B (quem quer vender pro produtor), não do produtor.

## 11. Riscos e cuidados

- **Credibilidade é frágil:** preço errado uma vez queima a confiança. Cuidar da fonte e marcar claramente o que é referência vs. relatado.
- **Curadoria manual cansa:** migrar para crowdsourcing/parceria em poucos meses.
- **Jurídico:** verificar termos do CEPEA antes de monetizar sobre os indicadores; nunca republicar dado proprietário (Scot etc.).
- **Não fazer delivery/logística no começo** — peso operacional alto demais para projeto solo.

## 12. Próximos passos sugeridos

1. Validar as fontes públicas reais (CEPEA, IMEA, B3, CONAB): o que cada uma libera e em que termos.
2. Definir o nome e a identidade visual.
3. Montar o esqueleto Next.js + Supabase com a tabela `cotacoes` e um scraper de exemplo (Firecrawl) puxando uma cotação.
4. Construir o gerador de card do boletim (prova de conceito da distribuição no Instagram).
5. Subir o Termômetro da Praça com 10–15 produtores da sua rede.
