import { MUNICIPIOS } from '@/lib/fontes/chuva';
import { PORTEIRA, TITULOS } from '@/lib/tipos-ui';

// A busca do cabeçalho. Índice montado do que o site já sabe — produtos, municípios
// e páginas —, então uma cotação nova aparece na busca sem ninguém lembrar de vir
// aqui. Roda inteira no navegador: sem rota, sem banco, sem espera.

export type Grupo = 'Produtos' | 'Cidades' | 'Páginas';

export type ItemBusca = {
  rotulo: string;
  sub: string;
  href: string;
  grupo: Grupo;
  /** Palavras que levam a este item — inclui apelidos da praça ('arroba', 'gado'). */
  termos: string[];
};

const PAGINAS: ItemBusca[] = [
  { rotulo: 'Notícias do Mercado', sub: 'O que mexe com o preço', href: '/', grupo: 'Páginas', termos: ['noticias', 'jornal', 'materia', 'reportagem'] },
  { rotulo: 'A praça hoje', sub: 'Todas as cotações', href: '/cotacoes', grupo: 'Páginas', termos: ['cotacoes', 'precos', 'painel', 'praca'] },
  { rotulo: 'Boletim do dia', sub: 'Card para compartilhar', href: '/boletim', grupo: 'Páginas', termos: ['boletim', 'card', 'imagem', 'zap', 'whatsapp'] },
  { rotulo: 'Chuva', sub: 'Previsão de 7 dias', href: '/chuva', grupo: 'Páginas', termos: ['chuva', 'tempo', 'previsao', 'clima', 'mm'] },
  { rotulo: 'Termômetro da Praça', sub: 'O preço na voz de quem está na lida', href: '/termometro', grupo: 'Páginas', termos: ['termometro', 'reporte', 'reportar', 'produtor'] },
  { rotulo: 'Fornecedores', sub: 'Agropecuárias e prestadores', href: '/fornecedores', grupo: 'Páginas', termos: ['fornecedor', 'loja', 'agropecuaria', 'racao', 'veterinario'] },
  { rotulo: 'Calculadora', sub: 'Valor do lote e da colheita', href: '/calculadora', grupo: 'Páginas', termos: ['calculadora', 'calcular', 'conta', 'lote', 'arroba', 'saca'] },
];

// Apelidos de porteira: quem procura 'gado' quer o boi; quem digita 'arroba' quer o
// preço da arroba. O título sozinho não pega isso.
const APELIDOS: Record<string, string[]> = {
  boi: ['gado', 'arroba', 'nelore', 'boiada', 'boi gordo'],
  vaca: ['vaca gorda', 'matriz'],
  novilha: ['reposicao', 'femea'],
  bezerro: ['reposicao', 'desmama', 'garrote'],
  soja: ['graos', 'saca'],
  milho: ['graos', 'saca'],
};

const MERCADO: Array<{ tipo: string; termos: string[] }> = [
  { tipo: 'dolar', termos: ['cambio', 'usd', 'moeda'] },
  { tipo: 'euro', termos: ['cambio', 'eur', 'moeda'] },
  { tipo: 'ouro', termos: ['grama', 'metal', '24k', '18k', 'joia'] },
  { tipo: 'ibovespa', termos: ['bolsa', 'b3', 'acoes', 'indice'] },
  { tipo: 'bitcoin', termos: ['cripto', 'btc', 'moeda digital'] },
  { tipo: 'ethereum', termos: ['cripto', 'eth', 'moeda digital'] },
];

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim();
}

export function indiceBusca(): ItemBusca[] {
  const produtos: ItemBusca[] = PORTEIRA.map((tipo) => ({
    rotulo: TITULOS[tipo] ?? tipo,
    sub: 'Cotação e histórico',
    href: `/cotacao/${tipo}`,
    grupo: 'Produtos' as const,
    termos: [tipo, ...(APELIDOS[tipo] ?? [])],
  }));

  const mercado: ItemBusca[] = MERCADO.map(({ tipo, termos }) => ({
    rotulo: TITULOS[tipo] ?? tipo,
    sub: 'Cotação e histórico',
    href: `/cotacao/${tipo}`,
    grupo: 'Produtos' as const,
    termos: [tipo, ...termos],
  }));

  const cidades: ItemBusca[] = MUNICIPIOS.map((m) => ({
    rotulo: m.nome,
    sub: `${m.uf} · chuva e termômetro`,
    href: '/chuva',
    grupo: 'Cidades' as const,
    termos: [m.nome, m.uf],
  }));

  return [...produtos, ...mercado, ...cidades, ...PAGINAS];
}

/**
 * Casa a consulta contra rótulo e termos, sem acento e sem caixa.
 *
 * Ordena por onde o casamento aconteceu: quem COMEÇA com o que foi digitado vem
 * antes de quem só contém. Sem isso, digitar 'boi' traria 'Bezerro' (termo
 * 'reposicao'... não) antes de 'Boi gordo' conforme a ordem do índice — e o
 * primeiro resultado é o que o Enter escolhe.
 */
export function buscar(indice: ItemBusca[], consulta: string, limite = 8): ItemBusca[] {
  const q = normalizar(consulta);
  if (q.length === 0) return [];

  const pontuar = (item: ItemBusca): number => {
    const rotulo = normalizar(item.rotulo);
    if (rotulo === q) return 0;
    if (rotulo.startsWith(q)) return 1;
    if (item.termos.some((t) => normalizar(t).startsWith(q))) return 2;
    if (rotulo.includes(q)) return 3;
    if (item.termos.some((t) => normalizar(t).includes(q))) return 4;
    return Infinity;
  };

  return indice
    .map((item) => ({ item, p: pontuar(item) }))
    .filter(({ p }) => p !== Infinity)
    .sort((a, b) => a.p - b.p)
    .slice(0, limite)
    .map(({ item }) => item);
}

/** Agrupa preservando a ordem de relevância dos grupos. */
export function agruparResultados(itens: ItemBusca[]): Array<{ grupo: Grupo; itens: ItemBusca[] }> {
  const mapa = new Map<Grupo, ItemBusca[]>();
  for (const item of itens) {
    const arr = mapa.get(item.grupo) ?? [];
    arr.push(item);
    mapa.set(item.grupo, arr);
  }
  return [...mapa.entries()].map(([grupo, itens]) => ({ grupo, itens }));
}
