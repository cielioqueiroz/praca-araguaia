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
const CLIMA = [
  'chuva', 'chuvas', 'seca', 'estiagem', 'clima', 'previsao do tempo', 'la nina',
  'el nino', 'geada', 'temporal', 'enchente',
];

// Palavras que sozinhas já dizem "isto é do agro", sem apontar categoria.
// 'campo' saiu: futebol é jogado em campo, e o Brasileirão vazava para a home.
const AGRO_GERAL = [
  'agro', 'agronegocio', 'agropecuaria', 'agricola', 'agricolas', 'agricultura',
  'fazenda', 'fazendas', 'produtor', 'produtores', 'rural', 'cooperativa', 'embrapa',
];

// O que decide se a notícia de um veículo amplo ENTRA. Estrito de propósito.
const TERMOS_RELEVANCIA = [
  ...PECUARIA, ...GRAOS, ...CLIMA, ...AGRO_GERAL,
  ...MERCADO.filter((t) => !SO_PARA_CATEGORIA.has(t)),
];

const GRUPOS: Array<{ categoria: Categoria; termos: string[] }> = [
  { categoria: 'pecuaria', termos: PECUARIA },
  { categoria: 'graos', termos: GRAOS },
  { categoria: 'clima', termos: CLIMA },
  { categoria: 'mercado', termos: MERCADO },
];

function textoDe(item: ItemBruto): string {
  return normalizar(`${item.titulo} ${item.resumo ?? ''}`);
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
 * Vale a pena mostrar? Veículo de nicho (Canal Rural, Notícias Agrícolas...) passa
 * direto — lá tudo é agro. Veículo amplo precisa de pelo menos uma palavra do ramo,
 * senão a home da praça enche de política e celebridade.
 */
export function relevante(item: ItemBruto, nicho: boolean): boolean {
  if (nicho) return true;
  const texto = textoDe(item);
  return TERMOS_RELEVANCIA.some((t) => contem(texto, t));
}
