# Praça Araguaia

Plataforma hiperlocal de preços do agro para o Vale do Araguaia (sul do PA, nordeste do MT, norte do TO). Este arquivo é **só o vocabulário** — o que cada palavra significa aqui dentro. Estado do projeto vive em `ESTADO-DO-PROJETO.md`; decisões, em `docs/adr/`.

Quem escreve código, texto de tela ou mensagem de bot usa estas palavras nestes sentidos. Quando uma palavra da lista aparecer com outro sentido, o certo é corrigir o texto — não esticar o sentido.

## O preço

**Cotação**:
Preço de referência que uma fonte externa publica e nós apenas repassamos, com crédito e data. Nunca é conta nossa.
_Evite_: valor de mercado, preço oficial, tabela

**Reporte**:
Preço que alguém que negociou de verdade informa ao Termômetro — o dado que só existe aqui. Passa por moderação antes de aparecer.
_Evite_: cotação do usuário, preço da comunidade, enquete

**Fechamento**:
O preço do dia já apurado pela fonte. O da Scot sai sempre referente ao dia útil anterior; "fechamento de hoje" não existe para o gado.
_Evite_: preço de hoje, preço ao vivo, tempo real

**Variação do lugar**:
A diferença entre o preço atual e o anterior **da mesma praça ou do mesmo estado**. Preço parado repete a variação em vez de zerá-la, e 0% é direção própria (`estável`) — não é alta.
_Evite_: variação do dia, alta/baixa quando o número não mudou

**Valor típico**:
A mediana dos reportes, que é o que o Termômetro publica. Resiste a um lance fora da curva.
_Evite_: **média** (a palavra saiu da interface de propósito na fatia 15 — o spread entre estados era grande demais para uma média significar alguma coisa)

**Faixa**:
O menor e o maior valor reportados no período. Só aparece com 2+ reportes.

**Desatualizado**:
Preço mais velho que o prazo da própria fonte (5 dias para quem publica diário, 10 para quem fecha semana). O selo é obrigatório: repetir número parado com cara de novidade foi o que já fez o dado parecer inventado.

## Onde o preço acontece

**Praça**:
A cidade onde o gado é negociado e cujo preço a fonte pesquisa — Marabá, Redenção, Paragominas. É a unidade de preço do gado.
_Evite_: mercado, região, cidade (quando o assunto for preço)

**Praça Araguaia**:
A marca, o produto, o site. Só isto — nunca uma praça de negócio chamada Araguaia, que não existe.

**Estado (UF)**:
A unidade de preço dos grãos, que é o recorte que a CONAB publica. Fora do Pará, também é como rotulamos a praça de referência mais próxima do Vale.

**Município**:
A cidade de quem usa o site — de onde vem um reporte, onde chove, quem visitou. Não confundir com praça: Confresa é município da chuva e do Termômetro, não praça da Scot.

**Vale do Araguaia**:
A região atendida. É o fallback quando não se sabe a cidade de quem está lendo. _Evite_: Barra do Garças, "sua região" genérico.

## O que é negociado

**Porteira**:
O que sai da fazenda: boi, vaca, novilha, bezerro, soja, milho. É a seção principal e a razão do site existir.

**Mercado**:
O que cerca a fazenda: dólar, euro, ouro, Ibovespa, bitcoin, ethereum. Contexto, nunca o assunto principal.

**Gordo**:
Animal de abate, negociado **por arroba** (R$/@) — boi gordo, vaca gorda.

**Reposição**:
Animal que vai para o pasto, negociado **por cabeça** — bezerro e novilha. Nunca por arroba: tratar novilha como gordo já produziu R$ 39.840 numa novilha de 400 kg.
_Evite_: novilha em R$/@, converter cabeça em arroba

**Arroba**:
15 kg de carcaça. O peso vivo vira arroba pelo rendimento, nunca direto.

## Distribuição

**Boletim**:
O card de preços do dia (PNG) publicado em `/boletim` e entregue pelo bot.

**Sessão**:
Qual boletim é: `abertura` (o preço com que o dia começa) ou `fechamento` (o número do dia, apurado). Hoje só o fechamento é entregue.

**Assinante**:
Quem deu `/start` no bot do Telegram. Não tem cadastro, nome nem senha — é um `chat_id` e, quando o clique trouxe, uma cidade.

**Alerta**:
Aviso de movimento forte (≥ 3%) disparado uma vez por ponto de preço. Não é preço-alvo pessoal.

## Quem vende

**Fornecedor**:
Quem quer vender para o produtor — agropecuária, revenda, veterinário, oficina. Cadastra-se sozinho e entra na vitrine depois de moderado.
_Evite_: anunciante, parceiro, cliente

**Vitrine**:
A lista pública de fornecedores aprovados, com contato direto por WhatsApp.

## Como o dado entra

**Coleta**:
A leitura diária das fontes que grava cotação e histórico. Roda 17:30 BRT, depois de a B3 fechar e de a Scot publicar.

**Moderação**:
A conferência do que veio de fora (reporte ou fornecedor) antes de ficar público. Sem ela, nada de terceiro aparece.

**Origem do reporte**:
Quem apurou o preço. `produtor` — chegou pelo formulário público, anônimo. `praca` — a Praça Araguaia apurou por telefone e lançou pela moderação, assinando por ele. A distinção é obrigatória na tela: os dois são preços reais, mas não têm a mesma testemunha.
_Evite_: lançar apuração própria como se fosse reporte de produtor

**Dia útil**:
Segunda a sexta, fora feriado nacional. Sábado, domingo e feriado não têm entrega nem preço novo — a fonte também não publica.
