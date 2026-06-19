import type { Cotacao, PontoHistorico } from '@/types/cotacao';

// O Brasil não usa horário de verão desde 2019, então o offset é fixo em -03:00.
// Sem isso, datas sem offset seriam interpretadas como hora local do runtime
// (UTC na Vercel), deslocando o timestamp em 3h.
const OFFSET_BRT = '-03:00';

const URL_AWESOME = 'https://economia.awesomeapi.com.br/last/USD-BRL';
// SGS série 1 = dólar comercial (venda), valor diário (dias úteis) do BCB.
const URL_BCB =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json';

// Fonte primária: AwesomeAPI (tempo real). A create_date vem em BRT, sem offset.
export async function buscarDolarAwesome(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(URL_AWESOME);
  if (!res.ok) throw new Error(`AwesomeAPI respondeu ${res.status}`);

  const body = (await res.json()) as { USDBRL?: { bid?: string; create_date?: string } };
  const raw = body?.USDBRL;
  const valor = Number(raw?.bid);

  if (!raw) {
    throw new Error('Resposta da AwesomeAPI inválida: objeto USDBRL ausente');
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta da AwesomeAPI inválida: bid ausente ou não positivo');
  }
  if (!raw.create_date) {
    throw new Error('Resposta da AwesomeAPI inválida: create_date ausente');
  }

  return {
    tipo: 'dolar',
    valor,
    unidade: 'R$',
    fonte: 'awesomeapi',
    dataReferencia: new Date(raw.create_date.replace(' ', 'T') + OFFSET_BRT).toISOString(),
  };
}

// Fonte de fallback: BCB (PTAX diária). Resposta: [{ data: 'dd/MM/yyyy', valor: '5.1382' }].
// Sem hora — usamos o início do dia em BRT como referência.
export async function buscarDolarBcb(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  const res = await fetchImpl(URL_BCB);
  if (!res.ok) throw new Error(`BCB respondeu ${res.status}`);

  const body = (await res.json()) as Array<{ data?: string; valor?: string }>;
  const item = Array.isArray(body) ? body[body.length - 1] : undefined;
  const valor = Number(item?.valor);

  if (!item || !Number.isFinite(valor) || valor <= 0) {
    throw new Error('Resposta do BCB inválida: valor ausente ou não positivo');
  }
  const [dd, mm, yyyy] = (item.data ?? '').split('/');
  if (!dd || !mm || !yyyy) {
    throw new Error('Resposta do BCB inválida: data ausente ou em formato inesperado');
  }

  return {
    tipo: 'dolar',
    valor,
    unidade: 'R$',
    fonte: 'bcb',
    dataReferencia: new Date(`${yyyy}-${mm}-${dd}T00:00:00${OFFSET_BRT}`).toISOString(),
  };
}

// O endpoint `ultimos/N` do BCB só aceita N pequeno (N grande → 400); usamos o
// intervalo de datas (dd/MM/yyyy em UTC), que devolve a série diária do período.
function urlBcbSerie(dias: number): string {
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000);
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${fmt(inicio)}&dataFinal=${fmt(fim)}`;
}

// Série histórica do dólar (PTAX diária) no BCB, para o backfill do gráfico.
export async function buscarHistoricoDolarBcb(
  dias = 90,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const res = await fetchImpl(urlBcbSerie(dias));
  if (!res.ok) throw new Error(`BCB respondeu ${res.status}`);

  const body = (await res.json()) as Array<{ data?: string; valor?: string }>;
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('Resposta do BCB inválida: série vazia');
  }

  return body.map((item) => {
    const valor = Number(item?.valor);
    const [dd, mm, yyyy] = (item?.data ?? '').split('/');
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Resposta do BCB inválida: valor ausente ou não positivo');
    }
    if (!dd || !mm || !yyyy) {
      throw new Error('Resposta do BCB inválida: data em formato inesperado');
    }
    return { data: new Date(`${yyyy}-${mm}-${dd}T00:00:00${OFFSET_BRT}`).toISOString(), valor };
  });
}

// Tenta a AwesomeAPI (tempo real) e, se falhar (ex.: 429 em IP de datacenter da
// Vercel), cai para o BCB. Mantém a coleta resiliente em produção.
export async function buscarDolar(fetchImpl: typeof fetch = fetch): Promise<Cotacao> {
  try {
    return await buscarDolarAwesome(fetchImpl);
  } catch (erroAwesome) {
    try {
      return await buscarDolarBcb(fetchImpl);
    } catch (erroBcb) {
      throw new Error(
        `Falha ao buscar dólar — AwesomeAPI: ${(erroAwesome as Error).message}; ` +
          `BCB: ${(erroBcb as Error).message}`,
      );
    }
  }
}
