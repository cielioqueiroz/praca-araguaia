// Apresentação por tipo de cotação (títulos, ordem do painel, legendas e frescor).

export const TITULOS: Record<string, string> = {
  boi: 'Boi gordo',
  vaca: 'Vaca gorda',
  novilha: 'Novilha',
  bezerro: 'Bezerro',
  soja: 'Soja',
  milho: 'Milho',
  dolar: 'Dólar',
  euro: 'Euro',
  ouro: 'Ouro',
  ibovespa: 'Ibovespa',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
};

// O Ibovespa é medido em PONTOS. Tudo mais no mercado é dinheiro.
export const NAO_E_MOEDA = new Set(['ibovespa']);

// A porteira: o curral e a lavoura. Também é a ordem de exibição.
export const PECUARIA = ['boi', 'vaca', 'novilha', 'bezerro'];
export const LAVOURA = ['soja', 'milho'];
export const PORTEIRA = [...PECUARIA, ...LAVOURA];

export const ORDEM_PAINEL = [
  ...PORTEIRA,
  'dolar',
  'euro',
  'ouro',
  'ibovespa',
  'bitcoin',
  'ethereum',
];

export const UNIDADE_PORTEIRA: Record<string, string> = {
  boi: 'R$ por arroba',
  vaca: 'R$ por arroba',
  // Reposição é negociada por cabeça, não por arroba — e a Scot publica assim.
  novilha: 'R$ por cabeça · fêmea nelore, 18 meses',
  bezerro: 'R$ por cabeça · 12 meses, 240 kg',
  soja: 'R$ por saca de 60 kg',
  milho: 'R$ por saca de 60 kg',
};

// Quem publica cada preço da porteira — e em que ritmo. A CONAB fecha a SEMANA; a
// Scot publica por DIA. O rodapé de cada card diz qual é qual, para ninguém achar
// que o bezerro de hoje foi apurado junto com a soja da semana.
//
// Na fatia 17, boi e vaca saíram da CONAB/Datagro para a Scot, que pesquisa PRAÇA
// (Marabá, Redenção…) em vez de estado; a novilha saiu da Datagro (novilha gorda,
// R$/@) para a Scot (reposição, R$/cabeça) — é outro produto, decidido com o dono.
//
// `via` é onde LEMOS o indicador, quando não é a própria fonte que publica para nós.
// A Scot apura; quem publica aberto é o Notícias Agrícolas. Dizer as duas coisas é
// obrigação, não gentileza — ver docs/adr/0001-indicador-scot-via-noticias-agricolas.md.
export const FONTE_PORTEIRA: Record<string, { nome: string; via?: string; semanal: boolean; porPraca?: boolean }> = {
  boi: { nome: 'Scot Consultoria', via: 'Notícias Agrícolas', semanal: false, porPraca: true },
  vaca: { nome: 'Scot Consultoria', via: 'Notícias Agrícolas', semanal: false, porPraca: true },
  novilha: { nome: 'Scot Consultoria', via: 'Notícias Agrícolas', semanal: false },
  bezerro: { nome: 'Scot Consultoria', via: 'Notícias Agrícolas', semanal: false },
  soja: { nome: 'CONAB', semanal: true },
  milho: { nome: 'CONAB', semanal: true },
};

/**
 * O crédito por extenso: quem apurou e, quando há, onde lemos.
 *
 * O card compacto continua com o nome curto + data ('Scot · 17/08') porque ali só
 * cabem duas palavras; este é o crédito de onde há linha de texto — rodapé do site,
 * linha de fontes, página do boletim.
 */
export function creditoFonte(tipo: string): string | undefined {
  const f = FONTE_PORTEIRA[tipo];
  if (!f) return undefined;
  return f.via ? `${f.nome}, via ${f.via}` : f.nome;
}

/** Uma linha por fonte da porteira, sem repetir quem publica os mesmos produtos. */
export function creditosDaPorteira(): { produtos: string; credito: string }[] {
  const porCredito = new Map<string, string[]>();
  for (const tipo of PORTEIRA) {
    const credito = creditoFonte(tipo);
    if (!credito) continue;
    porCredito.set(credito, [...(porCredito.get(credito) ?? []), TITULOS[tipo] ?? tipo]);
  }
  return [...porCredito].map(([credito, titulos]) => ({ produtos: titulos.join(', '), credito }));
}

// Os tipos cujo preço vem praça a praça (e não por estado).
export const PORTEIRA_POR_PRACA = new Set(
  Object.entries(FONTE_PORTEIRA).filter(([, f]) => f.porPraca).map(([tipo]) => tipo),
);

// O preço é o de cada praça/estado pesquisado na fonte — nunca uma média nossa.
export const LEGENDAS: Record<string, string> = Object.fromEntries(
  Object.entries(FONTE_PORTEIRA).map(([tipo, f]) => [
    tipo,
    `preço por ${f.porPraca ? 'praça' : 'estado'} · ${f.nome}`,
  ]),
);

const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
const CINCO_DIAS_MS = 5 * 24 * 60 * 60 * 1000;
const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;

// O ritmo sai do FONTE_PORTEIRA, não de uma segunda lista à mão: quando o boi
// mudou de CONAB (semanal) para Scot (diária) na fatia 17, uma lista paralela
// continuaria dando 10 dias de tolerância a um preço que agora sai todo dia.
// A Scot publica em dia útil e pode atrasar no fim de semana e no feriado, daí os
// 5 dias — e não os 2 das cotações de mercado, que saem todo dia corrido.
export function prazoDesatualizadoMs(tipo: string): number {
  const fonte = FONTE_PORTEIRA[tipo];
  if (!fonte) return DOIS_DIAS_MS;
  return fonte.semanal ? DEZ_DIAS_MS : CINCO_DIAS_MS;
}
