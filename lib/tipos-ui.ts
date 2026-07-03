// Apresentação por tipo de cotação (títulos, ordem do painel, legendas e frescor).

export const TITULOS: Record<string, string> = {
  boi: 'Boi gordo',
  soja: 'Soja',
  milho: 'Milho',
  dolar: 'Dólar',
  euro: 'Euro',
  ouro: 'Ouro',
};

export const ORDEM_PAINEL = ['boi', 'soja', 'milho', 'dolar', 'euro', 'ouro'];

// Média regional calculada por nós — não é indicador oficial; o card deixa isso explícito.
const LEGENDA_CONAB = 'média MT/PA/TO/GO · CONAB';
export const LEGENDAS: Record<string, string> = {
  boi: LEGENDA_CONAB,
  soja: LEGENDA_CONAB,
  milho: LEGENDA_CONAB,
};

const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;
const TIPOS_SEMANAIS = new Set(['boi', 'soja', 'milho']);

// Dado semanal (CONAB) só fica "desatualizado" depois de 10 dias.
export function prazoDesatualizadoMs(tipo: string): number {
  return TIPOS_SEMANAIS.has(tipo) ? DEZ_DIAS_MS : DOIS_DIAS_MS;
}
