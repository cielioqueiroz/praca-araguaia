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
  ouro: 'Ouro 24k',
  ouro18k: 'Ouro 18k',
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
  'ouro18k',
  'ibovespa',
  'bitcoin',
  'ethereum',
];

export const UNIDADE_PORTEIRA: Record<string, string> = {
  boi: 'R$ por arroba',
  vaca: 'R$ por arroba',
  novilha: 'R$ por arroba',
  bezerro: 'R$ por cabeça · 12 meses, 240 kg',
  soja: 'R$ por saca de 60 kg',
  milho: 'R$ por saca de 60 kg',
};

// Quem publica cada preço da porteira — e em que ritmo. A CONAB fecha a SEMANA;
// Datagro e Scot publicam por DIA. O rodapé de cada card diz qual é qual, para
// ninguém achar que o bezerro de hoje foi apurado junto com a soja da semana.
export const FONTE_PORTEIRA: Record<string, { nome: string; semanal: boolean }> = {
  boi: { nome: 'CONAB', semanal: true },
  soja: { nome: 'CONAB', semanal: true },
  milho: { nome: 'CONAB', semanal: true },
  vaca: { nome: 'Datagro', semanal: false },
  novilha: { nome: 'Datagro', semanal: false },
  bezerro: { nome: 'Scot Consultoria', semanal: false },
};

// O preço é o de cada estado pesquisado na fonte — nunca uma média nossa.
export const LEGENDAS: Record<string, string> = Object.fromEntries(
  Object.entries(FONTE_PORTEIRA).map(([tipo, f]) => [tipo, `preço por estado · ${f.nome}`]),
);

const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
const CINCO_DIAS_MS = 5 * 24 * 60 * 60 * 1000;
const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;

const TIPOS_SEMANAIS = new Set(['boi', 'soja', 'milho']);
// Datagro/Scot publicam em dia útil e podem atrasar no fim de semana e feriado.
const TIPOS_DIA_UTIL = new Set(['vaca', 'novilha', 'bezerro']);

// Dado semanal (CONAB) só fica "desatualizado" depois de 10 dias.
export function prazoDesatualizadoMs(tipo: string): number {
  if (TIPOS_SEMANAIS.has(tipo)) return DEZ_DIAS_MS;
  if (TIPOS_DIA_UTIL.has(tipo)) return CINCO_DIAS_MS;
  return DOIS_DIAS_MS;
}
