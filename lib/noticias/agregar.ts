import type { Feed, ItemBruto, Noticia } from '@/types/noticia';
import { categoria, relevante } from './classificar';

export const LIMITE_NOTICIAS = 40;

// Quantas notícias um mesmo veículo pode ocupar na página.
//
// Sem este teto, a ordenação por data entrega a home aos veículos que publicam mais:
// numa checagem contra os feeds reais, InfoMoney e CNN tomaram 17 das 40 vagas e o
// G1 Agronegócios entrou com UMA — numa página feita para quem cria boi. Ordem por
// data continua valendo; o teto só impede o afogamento.
export const LIMITE_POR_VEICULO = 6;

// Parâmetros de rastreamento mudam por origem: a MESMA matéria vem com utm_source
// diferente em dois feeds. Sem limpar, ela aparece duas vezes na grade.
const LIXO_QUERY = /^(utm_|fbclid|gclid|mc_|ref$|origem$|_ga$)/i;

/** URL da matéria sem rastreamento e sem barra final — a chave de identidade. */
export function normalizarLink(link: string): string {
  try {
    const u = new URL(link);
    for (const chave of [...u.searchParams.keys()]) {
      if (LIXO_QUERY.test(chave)) u.searchParams.delete(chave);
    }
    u.hash = '';
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./i, '').toLowerCase();
    const caminho = u.pathname.replace(/\/+$/, '');
    return `${u.hostname}${caminho}${u.search}`;
  } catch {
    return link.trim().toLowerCase();
  }
}

/** Título sem acento, pontuação nem caixa — pega o mesmo fato republicado. */
export function normalizarTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quando(n: Noticia): number {
  // Item sem data não é descartado (o veículo pode simplesmente não publicar
  // pubDate), mas vai para o fim da fila em vez de fingir ser o mais novo.
  return n.publicadoEm ? Date.parse(n.publicadoEm) : -Infinity;
}

export type Colhido = { feed: Feed; itens: ItemBruto[] };

/**
 * Junta os feeds, joga fora o que não é do ramo, tira repetição e ordena do mais
 * novo para o mais velho. Puro: recebe o que já foi buscado, não busca nada.
 */
/**
 * Aplica o teto por veículo mantendo a ordem por data. O que passou do teto não é
 * jogado fora: volta na segunda passada, para preencher a página quando há poucos
 * veículos vivos (feed fora do ar não pode deixar a home pela metade).
 */
function equilibrar(ordenadas: Noticia[], limite: number, tetoPorVeiculo: number): Noticia[] {
  const escolhidas: Noticia[] = [];
  const sobra: Noticia[] = [];
  const conta = new Map<string, number>();

  for (const n of ordenadas) {
    const usadas = conta.get(n.veiculo) ?? 0;
    if (usadas < tetoPorVeiculo) {
      escolhidas.push(n);
      conta.set(n.veiculo, usadas + 1);
    } else {
      sobra.push(n);
    }
  }

  if (escolhidas.length >= limite) return escolhidas.slice(0, limite);
  return [...escolhidas, ...sobra].slice(0, limite);
}

export function agregar(colhidos: Colhido[], limite = LIMITE_NOTICIAS): Noticia[] {
  const porLink = new Map<string, Noticia>();
  const titulosVistos = new Set<string>();

  for (const { feed, itens } of colhidos) {
    for (const item of itens) {
      if (!relevante(item, feed.nicho)) continue;

      const id = normalizarLink(item.link);
      if (porLink.has(id)) continue;

      const tituloChave = normalizarTitulo(item.titulo);
      // Título vazio depois de normalizar (ex.: só emoji) não vira chave de
      // dedupe, senão o primeiro item assim bloquearia todos os outros.
      if (tituloChave !== '' && titulosVistos.has(tituloChave)) continue;
      if (tituloChave !== '') titulosVistos.add(tituloChave);

      porLink.set(id, { ...item, id, veiculo: feed.veiculo, categoria: categoria(item) });
    }
  }

  const ordenadas = [...porLink.values()].sort((a, b) => quando(b) - quando(a));
  return equilibrar(ordenadas, limite, LIMITE_POR_VEICULO);
}
