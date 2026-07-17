import type { PrecoPraca } from '@/types/cotacao';

// Boi gordo e vaca gorda pela SCOT CONSULTORIA, praça por praça.
//
// Por que trocamos a CONAB aqui: a CONAB dá um preço por ESTADO, e a Scot pesquisa
// a PRAÇA — Marabá, Redenção e Paragominas são linhas distintas, e é nelas que o
// produtor do Araguaia vende. "Preço do Pará" não é o preço de ninguém.
//
// O contrato é o HTML: <table class="cot-fisicas"> com a data em <div
// class="fechamento">. A primeira tabela é o fechamento mais recente; as demais são
// histórico. Mesmo contrato que lib/fontes/pecuaria.ts já lê.
//
// Colunas: | UF Praça | Boi à vista R$/@ | Boi prazo 30d R$/@ | Vaca gorda R$/@ |

const OFFSET_BRT = '-03:00';
const URL_SCOT = 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-gordo-scot-consultoria';
const TTL_MS = 10 * 60 * 1000;

// O que a praça mostra: as três cidades do Pará que o Vale negocia, e UMA linha por
// estado vizinho. Chave: 'UF|praça' como a página escreve (sem acento, maiúsculo).
//
// POR QUE UMA LINHA POR ESTADO (decisão do dono, 17/07/2026): a Scot publica várias
// praças por estado (MT Norte, Sudeste, Cuiabá, Sudoeste; TO Norte e Sul; BA Sul e
// Oeste; GO Goiânia e Reg. Sul). Repetir todas enchia o card de "Norte", "Sul" e
// "Oeste" repetidos, sem o produtor daqui reconhecer nenhuma. Então, fora do Pará,
// escolhemos a PRAÇA DE REFERÊNCIA — a mais próxima do Araguaia — e a rotulamos com o
// nome do estado. O número continua sendo um preço real que alguém negocia (não uma
// média inventada), só que apresentado como "o preço do estado".
//
// A praça de referência de cada estado:
//   MT → Norte  (o norte de MT faz divisa com o Vale: Confresa, Vila Rica)
//   TO → Norte  (o Bico e o norte do Tocantins, à beira do Araguaia)
//   GO → Goiânia (a Scot só publica Goiânia e Reg. Sul em GO; Goiânia é a referência)
//   BA → Oeste  (o oeste baiano é a fronteira agrícola, perfil da nossa região)
//   MA → Oeste  (Imperatriz/Balsas, no oeste, encostado no Tocantins)
//
// Pernambuco não está aqui porque a Scot não cobre PE — apurado em 16/07/2026.
const PRACAS_DA_REGIAO: Record<string, { uf: string; praca: string }> = {
  'PA|MARABA': { uf: 'PA', praca: 'Marabá' },
  'PA|PARAGOMINAS': { uf: 'PA', praca: 'Paragominas' },
  'PA|REDENCAO': { uf: 'PA', praca: 'Redenção' },
  'MT|NORTE': { uf: 'MT', praca: 'Mato Grosso' },
  'TO|NORTE': { uf: 'TO', praca: 'Tocantins' },
  'GO|GOIANIA': { uf: 'GO', praca: 'Goiás' },
  'BA|OESTE': { uf: 'BA', praca: 'Bahia' },
  'MA|OESTE': { uf: 'MA', praca: 'Maranhão' },
};

// Ordem de exibição (a ordem que o dono pediu): as cidades do Pará primeiro, depois
// os estados vizinhos do Araguaia (MT, TO, GO) e a referência mais distante (BA, MA).
const ORDEM: string[] = [
  'PA|MARABA', 'PA|PARAGOMINAS', 'PA|REDENCAO',
  'MT|NORTE', 'TO|NORTE', 'GO|GOIANIA', 'BA|OESTE', 'MA|OESTE',
];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toUpperCase().trim();
}

function semTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** '326,50' → 326.5. Vazio, '***' ou não-número → null (nunca zero). */
function numeroBr(s: string): number | null {
  const limpo = s.replace(/\./g, '').replace(',', '.').replace('+', '').trim();
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** '15/07/2026' → ISO 00:00 BRT. */
function dataIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00${OFFSET_BRT}`).toISOString();
}

/**
 * 'MT Cuiabá*' → 'MT|CUIABA'.
 *
 * O asterisco marca nota de rodapé da Scot ("*preço com frete"), não faz parte do
 * nome. Linhas como 'SC' ou 'Alagoas' não têm o par sigla+praça e devolvem null —
 * não são da nossa região de qualquer forma.
 */
export function chaveDaLinha(celula: string): string | null {
  const limpo = semAcento(celula).replace(/\*/g, '').trim();
  const m = limpo.match(/^([A-Z]{2})\s+(.+)$/);
  return m ? `${m[1]}|${m[2].trim()}` : null;
}

export type LeituraScot = {
  dataReferencia: string;
  linhas: Array<{ uf: string; praca: string; boi: number | null; boiPrazo: number | null; vaca: number | null }>;
};

export function parseScot(html: string): LeituraScot | null {
  const data = html.match(/class="fechamento">\s*Fechamento:\s*([\d/]+)/);
  const dataReferencia = data ? dataIso(data[1].trim()) : null;
  if (!dataReferencia) return null;

  // Só a primeira tabela: as seguintes são fechamentos antigos.
  const tabela = html.match(/<table class="cot-fisicas">([\s\S]*?)<\/table>/);
  if (!tabela) return null;

  const achadas = new Map<string, { boi: number | null; boiPrazo: number | null; vaca: number | null }>();
  for (const linha of tabela[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const celulas = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => semTags(m[1]));
    if (celulas.length < 4) continue;

    const chave = chaveDaLinha(celulas[0]);
    if (!chave || !(chave in PRACAS_DA_REGIAO)) continue;

    achadas.set(chave, {
      boi: numeroBr(celulas[1]),
      boiPrazo: numeroBr(celulas[2]),
      vaca: numeroBr(celulas[3]),
    });
  }
  if (achadas.size === 0) return null;

  const linhas = ORDEM.flatMap((chave) => {
    const v = achadas.get(chave);
    // Praça ausente é omitida, não zerada: preço zero é mentira, ausência é verdade.
    return v ? [{ ...PRACAS_DA_REGIAO[chave], ...v }] : [];
  });
  return { dataReferencia, linhas };
}

let cache: { quando: number; leitura: LeituraScot } | null = null;

export function resetCacheScot(): void {
  cache = null;
}

async function carregar(fetchImpl: typeof fetch): Promise<LeituraScot> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.leitura;

  const res = await fetchImpl(URL_SCOT, {
    headers: { 'user-agent': 'PracaAraguaia/1.0 (+https://agroapp-bay.vercel.app)' },
  });
  if (!res.ok) throw new Error(`Scot respondeu ${res.status}`);

  // UTF-8, conferido byte a byte em 16/07/2026 ('á' chega como c3 a1) e batendo com
  // o charset declarado — então res.text() basta, como já faz o pecuaria.ts. (O
  // PrecosSemanalUF da CONAB é que é ISO-8859-1; não confundir os dois.)
  const leitura = parseScot(await res.text());
  if (!leitura) throw new Error('Não achei a tabela da Scot na página (o HTML mudou?)');
  if (leitura.linhas.length === 0) throw new Error('Sem praças da região na tabela da Scot');

  cache = { quando: Date.now(), leitura };
  return leitura;
}

export type TipoScot = 'boi' | 'vaca';

/** Preço de cada praça da região — é o que o painel mostra. */
export async function buscarPorPracaScot(tipo: TipoScot, fetchImpl: typeof fetch = fetch): Promise<PrecoPraca[]> {
  const { dataReferencia, linhas } = await carregar(fetchImpl);
  return linhas.flatMap((l) => {
    const valor = tipo === 'boi' ? l.boi : l.vaca;
    if (valor === null || valor <= 0) return [];
    return [{
      tipo,
      uf: l.uf,
      praca: l.praca,
      valor,
      unidade: 'R$/@',
      // A Scot não publica variação por praça, e não guardamos histórico por praça
      // para calcular — então o card mostra '—'. Inventar a variação comparando com
      // a média regional seria pior que não mostrar.
      variacaoPct: null,
      dataReferencia,
      ...(tipo === 'boi' && l.boiPrazo !== null ? { valorPrazo: l.boiPrazo } : {}),
    }];
  });
}

/** Valor único para `cotacoes`/histórico (o gráfico): média das praças da região. */
export async function buscarMediaScot(tipo: TipoScot, fetchImpl: typeof fetch = fetch) {
  const precos = await buscarPorPracaScot(tipo, fetchImpl);
  if (precos.length === 0) throw new Error(`Sem preço de ${tipo} nas praças da região`);

  const media = precos.reduce((s, p) => s + p.valor, 0) / precos.length;
  return {
    tipo,
    valor: Math.round(media * 100) / 100,
    unidade: 'R$/@',
    fonte: 'scot',
    dataReferencia: precos[0].dataReferencia,
  };
}
