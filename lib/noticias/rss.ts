import type { ItemBruto } from '@/types/noticia';

// Parser de RSS 2.0 e Atom, na régua do resto do projeto: regex sobre o texto, sem
// dependência nova. O contrato é o XML do veículo; se ele mudar, o parse devolve
// vazio e AQUELE feed some da página — os outros nove seguem (ver buscar.ts).
//
// Não é um parser de XML de uso geral e não precisa ser: feed é XML raso e
// previsível. O que ele precisa acertar é o que quebra na prática — CDATA,
// entidade dupla, item sem data e link do Atom no atributo.

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** '&amp;quot;Boi&amp;quot;' → '"Boi"'. Feeds costumam codificar duas vezes. */
export function decodificar(texto: string): string {
  const uma = (s: string) =>
    s
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&([a-z]+);/gi, (todo, nome) => ENTIDADES[nome.toLowerCase()] ?? todo);

  const passo1 = uma(texto);
  // Só decodifica de novo se a primeira passada revelou outra entidade — assim um
  // título que fala literalmente de "&amp;" não vira "&" errado.
  return /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(passo1) ? uma(passo1) : passo1;
}

function semCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function semTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Todo feed de WordPress carimba o resumo com "The post <título inteiro> appeared
// first on <veículo>." (ou "O post ... apareceu primeiro em ..."). No destaque da
// home isso aparecia como um parágrafo repetindo a manchete que já está logo acima.
// InfoMoney, Canal Rural, Money Times, Compre Rural e BeefPoint fazem todos isso.
const ASSINATURA_WORDPRESS = /\s*(?:The post\b[\s\S]*?\bappeared first on\b|O post\b[\s\S]*?\bapareceu primeiro em\b)[\s\S]*$/i;

/** Tira o carimbo do WordPress e o "Leia mais" do fim do resumo. */
export function limparResumo(texto: string): string {
  return texto
    .replace(ASSINATURA_WORDPRESS, '')
    .replace(/\s*(?:\[\.\.\.\]|\[…\]|Leia mais\.?|Continue lendo\.?|Saiba mais\.?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Conteúdo da primeira <tag> do bloco, já sem CDATA, tags e entidades. */
function tag(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'i'));
  if (!m) return null;
  const texto = decodificar(semTags(semCdata(m[1]))).trim();
  return texto === '' ? null : texto;
}

/** Data de feed ('Wed, 15 Jul 2026 10:22:00 -0300' ou ISO) → ISO. Inválida → null. */
export function dataDeFeed(bruta: string | null): string | null {
  if (!bruta) return null;
  const t = Date.parse(bruta);
  if (!Number.isFinite(t)) return null;
  // Data no futuro é relógio errado do veículo: não deixa furar a ordenação por
  // tempo. Uma folga de 1 dia cobre fuso mal declarado.
  if (t > Date.now() + 24 * 60 * 60 * 1000) return null;
  return new Date(t).toISOString();
}

function primeiroAtributo(bloco: string, re: RegExp): string | null {
  const m = bloco.match(re);
  return m ? decodificar(m[1]).trim() : null;
}

/** A imagem vem em 4 dialetos diferentes conforme o veículo. */
function imagemDoItem(bloco: string): string | null {
  const url =
    primeiroAtributo(bloco, /<media:content[^>]+url="([^"]+)"/i) ??
    primeiroAtributo(bloco, /<media:thumbnail[^>]+url="([^"]+)"/i) ??
    primeiroAtributo(bloco, /<enclosure[^>]+type="image\/[^"]*"[^>]*url="([^"]+)"/i) ??
    primeiroAtributo(bloco, /<enclosure[^>]+url="([^"]+)"[^>]*type="image\/[^"]*"/i) ??
    primeiroAtributo(bloco, /<img[^>]+src="([^"]+)"/i); // último recurso: <img> na descrição

  // Só http(s): 'data:' e caminho relativo do veículo não servem no nosso domínio.
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** O <link> do Atom é atributo, não conteúdo — e o rel="alternate" é o da matéria. */
function linkDoItem(bloco: string): string | null {
  const rss = tag(bloco, 'link');
  if (rss && /^https?:\/\//i.test(rss)) return rss;

  const alternate = primeiroAtributo(bloco, /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i);
  const qualquer = primeiroAtributo(bloco, /<link[^>]+href="([^"]+)"/i);
  const url = alternate ?? qualquer;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function blocos(xml: string): string[] {
  const itens = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi);
  if (itens && itens.length > 0) return itens;
  return xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [];
}

/**
 * XML do feed → itens. Sem exceção: XML quebrado ou vazio devolve [], porque uma
 * página de notícias não pode cair por causa do feed de um veículo.
 */
export function parseFeed(xml: string): ItemBruto[] {
  if (typeof xml !== 'string' || xml.trim() === '') return [];

  const itens: ItemBruto[] = [];
  for (const bloco of blocos(xml)) {
    const titulo = tag(bloco, 'title');
    const link = linkDoItem(bloco);
    // Sem título ou sem link não existe card clicável: descarta em silêncio.
    if (!titulo || !link) continue;

    // Limpa antes de cortar: cortar primeiro deixaria metade do carimbo do
    // WordPress no texto ("...apareceu primeiro em Canal Rura").
    const bruto = tag(bloco, 'description') ?? tag(bloco, 'summary');
    const resumo = bruto ? limparResumo(bruto).slice(0, 280) : '';

    itens.push({
      titulo,
      link,
      publicadoEm: dataDeFeed(tag(bloco, 'pubDate') ?? tag(bloco, 'published') ?? tag(bloco, 'updated')),
      resumo: resumo.length > 0 ? resumo : null,
      imagem: imagemDoItem(bloco),
    });
  }
  return itens;
}
