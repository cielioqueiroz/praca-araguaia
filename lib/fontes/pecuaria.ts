import type { Cotacao, PrecoUf } from '@/types/cotacao';

// Vaca gorda, novilha e bezerro — as categorias que faltavam na porteira.
//
// Por que não a CONAB: o arquivo semanal por UF (PrecosSemanalUF.txt) só publica
// BOI|GORDO. Vaca, novilha e bezerro não existem lá. Estas vêm dos indicadores
// publicados no Notícias Agrícolas:
//   vaca/novilha → Datagro, R$/@ por estado, com a variação já calculada;
//   bezerro      → Scot Consultoria, R$/cabeça (nelore 12 meses, 240 kg, 8@),
//                  que é como a praça negocia bezerro — sem coluna de variação.
//
// O HTML é o contrato: <table class="cot-fisicas"> com <td>estado</td><td>valor</td>…
// e a data em <div class="fechamento">. A primeira tabela da página é a do
// fechamento mais recente; as demais são o histórico. Se a página mudar, o parse
// devolve vazio e a coleta do tipo falha sozinha, sem derrubar as outras fontes.

const OFFSET_BRT = '-03:00';
const BASE = 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo';
const TTL_MS = 10 * 60 * 1000;

export type TipoPecuaria = 'vaca' | 'novilha' | 'bezerro';

type Pagina = { url: string; fonte: string; unidade: string; temVariacao: boolean };

const PAGINAS: Record<TipoPecuaria, Pagina> = {
  vaca: { url: `${BASE}/indicador-da-vaca`, fonte: 'datagro', unidade: 'R$/@', temVariacao: true },
  novilha: { url: `${BASE}/indicador-da-novilha`, fonte: 'datagro', unidade: 'R$/@', temVariacao: true },
  // A 2ª coluna do bezerro é R$/kg, não variação — por isso temVariacao: false.
  bezerro: { url: `${BASE}/macho-nelore-bezerro-12-meses`, fonte: 'scot', unidade: 'R$/cab', temVariacao: false },
};

// Ordem de exibição: a praça primeiro.
const ORDEM_UF = ['PA', 'MT', 'TO', 'GO'] as const;

// As páginas ora escrevem o nome ('Pará', às vezes sem acento), ora a sigla.
const POR_NOME: Record<string, string> = {
  PARA: 'PA',
  'MATO GROSSO': 'MT',
  TOCANTINS: 'TO',
  GOIAS: 'GO',
  PA: 'PA',
  MT: 'MT',
  TO: 'TO',
  GO: 'GO',
};

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toUpperCase().trim();
}

function semTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// '3.546,23' / '-0,25' / '+0,14' → number. Vazio ou '***' → null.
function numeroBr(s: string): number | null {
  const limpo = s.replace(/\./g, '').replace(',', '.').replace('+', '').trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

// '13/07/2026' → ISO 00:00 BRT.
function dataIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00${OFFSET_BRT}`).toISOString();
}

export type LeituraPecuaria = { dataReferencia: string; ufs: Array<{ uf: string; valor: number; variacaoPct: number | null }> };

export function parsePagina(html: string, temVariacao: boolean): LeituraPecuaria | null {
  const data = html.match(/class="fechamento">\s*Fechamento:\s*([\d/]+)/);
  const iso = data ? dataIso(data[1].trim()) : null;
  if (!iso) return null;

  // Só a primeira tabela: as seguintes são fechamentos antigos.
  const tabela = html.match(/<table class="cot-fisicas">([\s\S]*?)<\/table>/);
  if (!tabela) return null;

  const porUf = new Map<string, { valor: number; variacaoPct: number | null }>();
  for (const linha of tabela[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const celulas = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => semTags(m[1]));
    if (celulas.length < 2) continue;

    const uf = POR_NOME[semAcento(celulas[0])];
    if (!uf) continue;

    const valor = numeroBr(celulas[1]);
    if (valor === null || valor <= 0) continue; // linha sem preço nunca vira zero

    const variacaoPct = temVariacao ? numeroBr(celulas[2] ?? '') : null;
    porUf.set(uf, { valor, variacaoPct });
  }
  if (porUf.size === 0) return null;

  const ufs = ORDEM_UF.flatMap((uf) => {
    const linha = porUf.get(uf);
    return linha ? [{ uf, ...linha }] : []; // UF ausente é omitida, não zerada
  });
  return { dataReferencia: iso, ufs };
}

const cache = new Map<TipoPecuaria, { quando: number; leitura: LeituraPecuaria }>();

export function resetCachePecuaria(): void {
  cache.clear();
}

async function carregar(tipo: TipoPecuaria, fetchImpl: typeof fetch): Promise<LeituraPecuaria> {
  const guardado = cache.get(tipo);
  if (guardado && Date.now() - guardado.quando < TTL_MS) return guardado.leitura;

  const pagina = PAGINAS[tipo];
  const res = await fetchImpl(pagina.url, {
    headers: { 'user-agent': 'PracaAraguaia/1.0 (+https://agroapp-bay.vercel.app)' },
  });
  if (!res.ok) throw new Error(`Notícias Agrícolas respondeu ${res.status} para ${tipo}`);

  const leitura = parsePagina(await res.text(), pagina.temVariacao);
  if (!leitura) throw new Error(`Não achei a tabela de ${tipo} na página (o HTML mudou?)`);
  if (leitura.ufs.length === 0) throw new Error(`Sem PA/MT/TO/GO na tabela de ${tipo}`);

  cache.set(tipo, { quando: Date.now(), leitura });
  return leitura;
}

/** Preço de CADA UF da praça — é o que o painel e o boletim mostram. */
export async function buscarPorUfPecuaria(
  tipo: TipoPecuaria,
  fetchImpl: typeof fetch = fetch,
): Promise<PrecoUf[]> {
  const { dataReferencia, ufs } = await carregar(tipo, fetchImpl);
  const { unidade } = PAGINAS[tipo];
  return ufs.map((u) => ({ tipo, uf: u.uf, valor: u.valor, unidade, variacaoPct: u.variacaoPct, dataReferencia }));
}

/** Valor único para `cotacoes`/histórico (gráfico): média das UFs da praça — o
 *  mesmo critério que o boi da CONAB já usa. O que a praça vê é sempre o por-UF. */
async function buscarMedia(tipo: TipoPecuaria, fetchImpl: typeof fetch): Promise<Cotacao> {
  const { dataReferencia, ufs } = await carregar(tipo, fetchImpl);
  if (ufs.length === 0) throw new Error(`Sem dados de ${tipo} para PA/MT/TO/GO`);

  const media = ufs.reduce((s, u) => s + u.valor, 0) / ufs.length;
  const { unidade, fonte } = PAGINAS[tipo];
  return { tipo, valor: Math.round(media * 100) / 100, unidade, fonte, dataReferencia };
}

export const buscarVaca = (fetchImpl: typeof fetch = fetch) => buscarMedia('vaca', fetchImpl);
export const buscarNovilha = (fetchImpl: typeof fetch = fetch) => buscarMedia('novilha', fetchImpl);
export const buscarBezerro = (fetchImpl: typeof fetch = fetch) => buscarMedia('bezerro', fetchImpl);
