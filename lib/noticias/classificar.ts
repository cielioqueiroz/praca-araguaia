import type { Categoria, ItemBruto } from '@/types/noticia';

// Feed amplo (G1 Economia, CNN, R7, InfoMoney) traz muita coisa que não interessa
// a quem vive do gado e do grão. Aqui é onde a página deixa de ser "um portal" e
// vira "o portal da praça": só passa o que fala do agro ou do que mexe no preço dele.

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase();
}

// Casa palavra inteira: sem isto, 'ouro' acha 'ouro' dentro de 'tesouro' e 'boi'
// dentro de 'boinas'. \b não serve porque o texto já veio sem acento mas com
// hífen e barra, então a borda é "não-letra".
function contem(texto: string, termo: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${termo}([^a-z0-9]|$)`, 'i').test(texto);
}

const PECUARIA = [
  'boi', 'bois', 'gado', 'pecuaria', 'pecuarista', 'pecuaristas', 'arroba', 'arrobas',
  'frigorifico', 'frigorificos', 'bezerro', 'bezerros', 'bezerra', 'novilha', 'novilho',
  'vaca', 'vacas', 'nelore', 'boiada', 'carne', 'carnes', 'abate', 'abates', 'confinamento',
  'rebanho', 'leite', 'boi gordo', 'reposicao',
];

const GRAOS = [
  'soja', 'milho', 'safra', 'safrinha', 'graos', 'grao', 'plantio', 'colheita', 'lavoura',
  'lavouras', 'sorgo', 'algodao', 'trigo', 'arroz', 'fertilizante', 'fertilizantes',
  'defensivo', 'defensivos', 'semente', 'sementes', 'conab', 'plantar',
];

// Termos de mercado que ficaram de fora de propósito, testados contra os feeds reais
// em 16/07/2026: 'juros' trazia "Telefônica aprova R$ 500 mi em JCP" (juros sobre
// capital próprio), e 'bolsa', 'selic', 'inflacao', 'b3' e 'china' enchiam a home de
// notícia de empresa e de política sem nada de agro.
const MERCADO = [
  'dolar', 'euro', 'cambio', 'ouro', 'commodities', 'commodity', 'ibovespa',
  'exportacao', 'exportacoes', 'importacao', 'bitcoin', 'cripto', 'cepea',
  'tarifa', 'tarifas', 'safra recorde',
];

// Palavra ambígua demais para DECIDIR se a notícia entra, mas boa para dizer de que
// ela trata quando já entrou. 'tarifa' no título de uma matéria do agro é a tarifa
// dos EUA sobre a carne; no resumo de uma matéria de telecom, é conta de telefone.
// Por isso vale para categoria (só título) e não para relevância (título + resumo).
const SO_PARA_CATEGORIA = new Set(['tarifa', 'tarifas']);

// 'tempo' sozinho trazia "tempo real" e "tempo de jogo"; 'previsao' trazia
// "previsão do PIB". Viraram frase, que é como aparecem quando é clima de verdade.
//
// CLIMA VALE PARA A CATEGORIA, NÃO PARA A RELEVÂNCIA (23/07/2026). Enquanto valia
// para as duas, "Starship 13 é adiado por causa do clima" e "El Niño: governo
// antecipa contratos de reserva de energia" entravam na home — os dois únicos itens
// que passaram só por clima numa medição contra os feeds reais, e os dois fora do
// ramo. O clima que interessa aqui vem colado em safra, lavoura, colheita ou
// produtor, e é por essas palavras que ele entra; o chip continua dizendo 'clima'.
const CLIMA = [
  'chuva', 'chuvas', 'seca', 'estiagem', 'clima', 'previsao do tempo', 'la nina',
  'el nino', 'geada', 'temporal', 'temporais', 'enchente',
];

// Palavras que sozinhas já dizem "isto é do agro", sem apontar categoria.
// 'campo' saiu: futebol é jogado em campo, e o Brasileirão vazava para a home.
const AGRO_GERAL = [
  'agro', 'agronegocio', 'agropecuaria', 'agricola', 'agricolas', 'agricultura',
  'fazenda', 'fazendas', 'produtor', 'produtores', 'rural', 'rurais', 'cooperativa',
  'embrapa', 'mapa desmente', 'sanidade', 'aftosa', 'brucelose', 'mosca-varejeira',
];

// O custo e a logística da porteira: não são "o preço", mas mexem no bolso de quem
// produz, e é por isso que entram no recorte "mercado e produção" que o dono pediu.
// Sem esta lista, "Câmara aprova piso do frete" e "renegociação de dívidas rurais"
// — notícia dura de Canal Rural — caíam junto com o lifestyle.
const CUSTOS = [
  'frete', 'diesel', 'combustivel', 'maquinas agricolas', 'trator', 'tratores',
  'colheitadeira', 'colheitadeiras', 'plano safra', 'credito rural', 'divida rural',
  'dividas rurais', 'armazenagem', 'silo', 'silos', 'irrigacao', 'pastagem',
  'pastagens', 'confinamento', 'racao', 'caminhoneiros',
];

// O que decide se a notícia ENTRA. Estrito de propósito — e desde 23/07/2026 vale
// para TODO veículo, inclusive os de agro (ver `relevante`).
const TERMOS_RELEVANCIA = [
  ...PECUARIA, ...GRAOS, ...AGRO_GERAL, ...CUSTOS,
  ...MERCADO.filter((t) => !SO_PARA_CATEGORIA.has(t)),
];

// ---------------------------------------------------------------------------
// O que NUNCA entra, mesmo trazendo palavra do ramo.
//
// A palavra do agro sozinha abria a porta para a página de entretenimento: 'fazenda'
// é o reality show da Record; 'boi' é o Boi Bumbá; 'colmeia' veio com Angelina Jolie
// num feed de agro. Todos abaixo saíram de itens reais dos feeds, medidos em
// 23/07/2026 — ou são o caso clássico do veículo (novela, futebol, receita).
//
// Vale sobre título + resumo e ganha da relevância: bloqueio é veto, não empate.
const BLOQUEIO = [
  // entretenimento e celebridade
  'reality', 'bbb', 'novela', 'novelas', 'famoso', 'famosos', 'celebridade',
  'celebridades', 'ator', 'atriz', 'cantor', 'cantora', 'apresentador',
  'apresentadora', 'hollywood', 'netflix', 'filme', 'filmes', 'serie', 'series',
  'minisserie', 'bumba', 'carnaval', 'ao vivo na tv', 'estreia', 'estreou',
  // 'peão' ficou de fora: na Record é o participante do reality, mas na praça é o
  // trabalhador da fazenda — e notícia de peão de fazenda é notícia daqui.
  // esporte
  'brasileirao', 'libertadores', 'escalacoes', 'escalacao', 'onde assistir',
  'gols', 'campeonato', 'copa do mundo', 'olimpiadas', 'jogador', 'jogadores',
  'torcida', 'campeoes',
  // culinária e lifestyle
  'aprenda a fazer', 'modo de preparo', 'receita nosso campo', 'horta em casa',
  'jardim', 'jardinagem', 'pets', 'mini-horses', 'curiosidades',
  // O gênero "dicas de cultivo" — a maior sobra depois do primeiro corte, quase toda
  // da Globo Rural: plantio de oliveiras, coco anão, mirtilo, microverdes, avestruz.
  // É agro de verdade, mas não é o segmento da praça (boi, vaca, soja, milho) nem
  // mexe no preço de nada aqui. O padrão é a manchete de tutorial, não a palavra.
  'dicas', 'guia para iniciantes', 'passo a passo', 'quer produzir', 'quer criar',
  'como cultivar', 'como criar', 'como montar', 'como armazenar', 'como plantar',
  'como fazer', 'para que serve', 'voce conhece', 'saiba o que', 'veja como funciona',
];

/** Assunto que a praça não quer ver, custe o que custar. Veto sobre a relevância. */
export function bloqueado(item: ItemBruto): boolean {
  const texto = textoDe(item);
  return BLOQUEIO.some((t) => contem(texto, t));
}

const GRUPOS: Array<{ categoria: Categoria; termos: string[] }> = [
  { categoria: 'pecuaria', termos: PECUARIA },
  { categoria: 'graos', termos: GRAOS },
  { categoria: 'clima', termos: CLIMA },
  { categoria: 'mercado', termos: MERCADO },
];

// Onde o fato aconteceu — outra pergunta, não outra categoria.
//
// "China suspende compra de carne brasileira" é PECUÁRIA (é o que o pecuarista
// precisa saber) E é internacional. Se 'internacional' fosse uma seção, essa
// notícia sairia de Pecuária e o pecuarista não a acharia onde procura. Por isso
// vira etiqueta no card e filtro no chip, cruzando as seções em vez de disputar
// com elas.
// País ou ator estrangeiro explícito, e nada mais. 'exportacao' e 'global' ficaram
// de fora depois de medir: marcavam 23 de 40 notícias, e etiqueta que aparece em
// mais da metade da página não informa nada. Exportar é o dia a dia do agro
// brasileiro — o que é notícia de fora é quem está do outro lado.
const FORA = [
  'eua', 'estados unidos', 'estadunidense', 'washington', 'trump',
  'china', 'chinesa', 'chines', 'chineses',
  'uniao europeia', 'europeia', 'europeu', 'europeus',
  'argentina', 'russia', 'russo', 'paraguai', 'uruguai', 'india', 'japao',
  'mercosul', 'omc', 'usda', 'fda', 'tarifaco',
];

function textoDe(item: ItemBruto): string {
  return normalizar(`${item.titulo} ${item.resumo ?? ''}`);
}

/** A notícia fala de fora do Brasil? Só o título decide, como a categoria. */
export function internacional(item: ItemBruto): boolean {
  const titulo = normalizar(item.titulo);
  return FORA.some((t) => contem(titulo, t));
}

/**
 * A categoria do chip. Duas regras, ambas tiradas de erro real nos feeds:
 *
 * 1. Só o TÍTULO decide. Classificar pelo resumo deixava uma menção de passagem
 *    sequestrar a categoria: "Boletim Macrofiscal mantém PIB em 2,3%" caía em CLIMA
 *    porque o resumo citava "El Niño" entre os riscos. Se a manchete não diz do que
 *    trata na nossa língua, o honesto é 'geral' — não chutar pelo rodapé do texto.
 *
 * 2. Ordem importa: "boi gordo sobe com dólar em alta" é PECUÁRIA para quem cria
 *    boi, não câmbio. Por isso pecuária e grãos ganham de mercado.
 */
export function categoria(item: ItemBruto): Categoria {
  const titulo = normalizar(item.titulo);
  for (const grupo of GRUPOS) {
    if (grupo.termos.some((t) => contem(titulo, t))) return grupo.categoria;
  }
  return 'geral';
}

/**
 * Vale a pena mostrar?
 *
 * DUAS REGRAS, e a mesma régua para todo veículo (mudou em 23/07/2026):
 *
 * 1. Nada de bloqueado. Entretenimento, esporte e receita saem mesmo trazendo
 *    palavra do ramo — 'fazenda' é o reality, 'boi' é o bumbá.
 * 2. Pelo menos uma palavra de mercado ou de produção, no título ou no resumo.
 *
 * POR QUE O VEÍCULO DE AGRO PERDEU O PASSE LIVRE: enquanto `nicho: true` dispensava
 * o filtro, quem publicava lifestyle entre as matérias de mercado entregava
 * lifestyle na home — "Angelina Jolie trocou Hollywood pelas colmeias" (Compre
 * Rural), "Como montar uma horta em casa" e "mini-horses criados como pets" (Globo
 * Rural) chegaram assim. Ser um site de agro diz de onde a matéria vem, não do que
 * ela trata; quem decide isso é o texto.
 */
export function relevante(item: ItemBruto): boolean {
  if (bloqueado(item)) return false;
  const texto = textoDe(item);
  return TERMOS_RELEVANCIA.some((t) => contem(texto, t));
}
