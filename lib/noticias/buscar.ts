import type { Noticia } from '@/types/noticia';
import { agregar, type Colhido } from './agregar';
import { FEEDS } from './feeds';
import { completarImagens } from './og';
import { parseFeed } from './rss';

// O único módulo de notícias que toca a rede. Tudo que decide alguma coisa
// (parsear, filtrar, deduplicar, ordenar) está nos módulos puros ao lado.

const TIMEOUT_MS = 8000;

// Sem user-agent próprio, parte dos veículos devolve 403 para datacenter — a
// mesma lição que o dólar deu com a AwesomeAPI na Vercel.
const UA = 'PracaAraguaia/1.0 (+https://agroapp-bay.vercel.app)';

async function colher(feed: (typeof FEEDS)[number], fetchImpl: typeof fetch): Promise<Colhido> {
  const res = await fetchImpl(feed.url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${feed.veiculo} respondeu ${res.status}`);

  const itens = parseFeed(await res.text());
  if (itens.length === 0) throw new Error(`${feed.veiculo}: feed sem itens (o XML mudou?)`);
  return { feed, itens };
}

/**
 * Lê todos os feeds em paralelo e devolve as notícias prontas.
 *
 * Um veículo fora do ar NÃO derruba a página: allSettled, e quem falhou fica de
 * fora desta rodada. Todos falharem devolve [] — a página mostra estado vazio, que
 * é honesto, em vez de erro 500.
 */
export async function buscarNoticias(fetchImpl: typeof fetch = fetch): Promise<Noticia[]> {
  const resultados = await Promise.allSettled(FEEDS.map((f) => colher(f, fetchImpl)));

  const colhidos: Colhido[] = [];
  for (const [i, r] of resultados.entries()) {
    if (r.status === 'fulfilled') colhidos.push(r.value);
    // Sem log, uma queda silenciosa de feed vira "a página está mais vazia hoje" e
    // ninguém descobre. Foi a lição anotada na fatia da chuva.
    else console.error(`[noticias] ${FEEDS[i].id} falhou:`, r.reason);
  }

  // Completa depois de agregar, e não antes: assim só busca a og:image das ~40 que
  // vão para a tela, e não das ~350 que os feeds trouxeram.
  return completarImagens(agregar(colhidos), fetchImpl);
}
