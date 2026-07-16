import type { Noticia } from '@/types/noticia';

// Nem todo veículo põe imagem no feed: Money Times e BeefPoint não põem NENHUMA
// (apurado em 16/07/2026). Sem isto, a notícia deles cai sempre no bloco liso — e o
// BeefPoint é a única fonte só de pecuária que temos, não dá para deixar de fora.
//
// A saída é ler a og:image da própria matéria: é a foto que o veículo escolheu para
// quando o link é compartilhado, então é a imagem certa, servida pelo domínio dele.

const TIMEOUT_MS = 5000;
const UA = 'PracaAraguaia/1.0 (+https://agroapp-bay.vercel.app)';

// Só o <head> interessa e ele vem nos primeiros KB. Ler a matéria inteira (às vezes
// centenas de KB) para pegar uma <meta> seria desperdício em toda revalidação.
const LIMITE_BYTES = 60_000;

/** <meta property="og:image" content="..."> — nas duas ordens de atributo. */
export function extrairOgImage(html: string): string | null {
  const padroes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of padroes) {
    const m = html.match(re);
    const url = m?.[1]?.trim();
    // Só http(s): caminho relativo do veículo não resolve no nosso domínio.
    if (url && /^https?:\/\//i.test(url)) return url.replace(/&amp;/g, '&');
  }
  return null;
}

async function buscarOg(link: string, fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchImpl(link, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.body) return null;

  // Lê só o começo e larga a conexão assim que o <head> passou.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < LIMITE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return extrairOgImage(html);
}

/**
 * Completa as notícias sem foto com a og:image da matéria.
 *
 * Só busca as que faltam (hoje ~7 de 40), em paralelo. Falha ou demora de um
 * veículo não muda nada: aquela notícia segue sem imagem e cai no bloco da marca —
 * a página nunca espera nem quebra por causa de uma foto.
 */
export async function completarImagens(noticias: Noticia[], fetchImpl: typeof fetch = fetch): Promise<Noticia[]> {
  const faltando = noticias.filter((n) => !n.imagem);
  if (faltando.length === 0) return noticias;

  const achadas = new Map<string, string>();
  await Promise.allSettled(
    faltando.map(async (n) => {
      const url = await buscarOg(n.link, fetchImpl);
      if (url) achadas.set(n.id, url);
    }),
  );

  return noticias.map((n) => (n.imagem ? n : { ...n, imagem: achadas.get(n.id) ?? null }));
}
