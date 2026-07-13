import type { Cotacao, PontoHistorico, PrecoUf } from '@/types/cotacao';

// Brasil sem horário de verão desde 2019: offset fixo -03:00.
const OFFSET_BRT = '-03:00';
const URL_CONAB = 'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosSemanalUF.txt';

// UFs da praça do Araguaia. A ordem é a de exibição (a região fica antes do resto).
const ORDEM_UF = ['PA', 'MT', 'TO', 'GO'] as const;
const UFS = new Set<string>(ORDEM_UF);
const TTL_MS = 10 * 60 * 1000;

export type TipoCommodity = 'boi' | 'soja' | 'milho';

// produto|classificação do arquivo → nosso tipo.
const PRODUTOS: Record<string, TipoCommodity> = {
  'BOI|GORDO': 'boi',
  'SOJA|EM GRÃOS': 'soja',
  'MILHO|EM GRÃOS': 'milho',
};

// O arquivo traz R$/kg; convenção de mercado: boi em arroba, grãos em saca de 60 kg.
const FATOR: Record<TipoCommodity, number> = { boi: 15, soja: 60, milho: 60 };
const UNIDADE: Record<TipoCommodity, string> = { boi: 'R$/@', soja: 'R$/sc 60kg', milho: 'R$/sc 60kg' };

type SemanaUf = { tipo: TipoCommodity; uf: string; fimSemana: string; valorKg: number };

let cache: { quando: number; linhas: SemanaUf[] } | null = null;

export function resetCacheConab(): void {
  cache = null;
}

// '22-06-2026 - 26-06-2026' → ISO do último dia da semana (00:00 BRT).
function fimDaSemanaIso(intervalo: string): string | null {
  const fim = intervalo.split(' - ')[1]?.trim();
  const m = fim?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00${OFFSET_BRT}`).toISOString();
}

// Parse tolerante: linha malformada ou valor inválido é ignorado, não derruba o arquivo.
function parse(texto: string): SemanaUf[] {
  const linhas: SemanaUf[] = [];
  for (const linha of texto.split('\n')) {
    const c = linha.split(';');
    if (c.length < 11) continue;
    const tipo = PRODUTOS[`${c[0].trim()}|${c[1].trim()}`];
    if (!tipo) continue;
    const uf = c[3].trim();
    if (!UFS.has(uf)) continue;
    // Nível vem truncado no arquivo ('PREÇO RECEBIDO P/ PR'); comparar por prefixo.
    if (!c[9].trim().startsWith('PREÇO RECEBIDO')) continue;
    const fimSemana = fimDaSemanaIso(c[7].trim());
    if (!fimSemana) continue;
    const valorKg = Number(c[10].trim().replace(',', '.'));
    if (!Number.isFinite(valorKg) || valorKg <= 0) continue;
    linhas.push({ tipo, uf, fimSemana, valorKg });
  }
  return linhas;
}

// Baixa e parseia o arquivo 1x por coleta (3 tipos compartilham o download).
async function carregar(fetchImpl: typeof fetch): Promise<SemanaUf[]> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.linhas;
  const res = await fetchImpl(URL_CONAB);
  if (!res.ok) throw new Error(`CONAB respondeu ${res.status}`);
  const texto = new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
  const linhas = parse(texto);
  cache = { quando: Date.now(), linhas };
  return linhas;
}

// Uma média por semana (das UFs disponíveis), já convertida, ordem ascendente.
function mediasSemanais(linhas: SemanaUf[], tipo: TipoCommodity): PontoHistorico[] {
  const porSemana = new Map<string, number[]>();
  for (const l of linhas) {
    if (l.tipo !== tipo) continue;
    const valores = porSemana.get(l.fimSemana) ?? [];
    valores.push(l.valorKg);
    porSemana.set(l.fimSemana, valores);
  }
  const fator = FATOR[tipo];
  return [...porSemana.entries()]
    .map(([data, valores]) => ({
      data,
      valor: Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * fator * 100) / 100,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function buscarCommodity(tipo: TipoCommodity, fetchImpl: typeof fetch): Promise<Cotacao> {
  const pontos = mediasSemanais(await carregar(fetchImpl), tipo);
  const ultimo = pontos[pontos.length - 1];
  if (!ultimo) throw new Error(`CONAB sem dados de ${tipo} para MT/PA/TO/GO`);
  return { tipo, valor: ultimo.valor, unidade: UNIDADE[tipo], fonte: 'conab', dataReferencia: ultimo.data };
}

// Preço de CADA UF (sem média), com a variação contra a semana anterior daquela UF —
// a série vem do próprio arquivo, então não depende do histórico no banco.
export async function buscarPorUf(
  tipo: TipoCommodity,
  fetchImpl: typeof fetch = fetch,
): Promise<PrecoUf[]> {
  const linhas = (await carregar(fetchImpl)).filter((l) => l.tipo === tipo);
  const fator = FATOR[tipo];

  return ORDEM_UF.flatMap((uf) => {
    const semanas = linhas
      .filter((l) => l.uf === uf)
      .sort((a, b) => a.fimSemana.localeCompare(b.fimSemana));

    const atual = semanas[semanas.length - 1];
    if (!atual) return []; // UF sem dado é omitida, nunca vira zero

    const anterior = semanas[semanas.length - 2];
    const variacaoPct = anterior
      ? Math.round(((atual.valorKg - anterior.valorKg) / anterior.valorKg) * 100 * 100) / 100
      : null;

    return [
      {
        tipo,
        uf,
        valor: Math.round(atual.valorKg * fator * 100) / 100,
        unidade: UNIDADE[tipo],
        variacaoPct,
        dataReferencia: atual.fimSemana,
      },
    ];
  });
}

export const buscarBoi = (fetchImpl: typeof fetch = fetch) => buscarCommodity('boi', fetchImpl);
export const buscarSoja = (fetchImpl: typeof fetch = fetch) => buscarCommodity('soja', fetchImpl);
export const buscarMilho = (fetchImpl: typeof fetch = fetch) => buscarCommodity('milho', fetchImpl);

// Série semanal completa do arquivo (~18 meses), para o backfill idempotente.
export async function buscarHistoricoConab(
  tipo: TipoCommodity,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const pontos = mediasSemanais(await carregar(fetchImpl), tipo);
  if (pontos.length === 0) throw new Error(`CONAB sem histórico de ${tipo}`);
  return pontos;
}
