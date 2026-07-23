import { describe, it, expect, vi } from 'vitest';
import { parseFeed, decodificar, dataDeFeed, limparResumo } from '@/lib/noticias/rss';
import { categoria, relevante, internacional } from '@/lib/noticias/classificar';
import { extrairOgImage, completarImagens } from '@/lib/noticias/og';
import { agregar, normalizarLink, normalizarTitulo, LIMITE_POR_VEICULO } from '@/lib/noticias/agregar';
import { FEEDS } from '@/lib/noticias/feeds';
import type { Feed, ItemBruto, Noticia } from '@/types/noticia';

const item = (extra: Partial<ItemBruto> = {}): ItemBruto => ({
  titulo: 'Preço do boi gordo sobe em Redenção',
  link: 'https://g1.globo.com/materia-1',
  publicadoEm: '2026-07-15T10:00:00.000Z',
  resumo: null,
  imagem: null,
  ...extra,
});

const feed = (extra: Partial<Feed> = {}): Feed => ({
  id: 'g1', veiculo: 'G1', url: 'https://g1.globo.com/rss', ...extra,
});

const rss = (itens: string) => `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Feed do veículo</title><link>https://veiculo.com</link>${itens}</channel></rss>`;

describe('parseFeed — RSS 2.0', () => {
  it('extrai título, link, data, resumo e imagem', () => {
    const xml = rss(`<item>
      <title>Boi gordo sobe</title>
      <link>https://g1.globo.com/boi</link>
      <pubDate>Wed, 15 Jul 2026 10:22:00 -0300</pubDate>
      <description>A arroba subiu em Marabá</description>
      <media:content url="https://img.globo.com/boi.jpg" />
    </item>`);

    expect(parseFeed(xml)).toEqual([{
      titulo: 'Boi gordo sobe',
      link: 'https://g1.globo.com/boi',
      publicadoEm: '2026-07-15T13:22:00.000Z',
      resumo: 'A arroba subiu em Marabá',
      imagem: 'https://img.globo.com/boi.jpg',
    }]);
  });

  it('desembrulha CDATA', () => {
    const xml = rss(`<item><title><![CDATA[Soja & milho em alta]]></title>
      <link><![CDATA[https://x.com/a]]></link></item>`);
    expect(parseFeed(xml)[0].titulo).toBe('Soja & milho em alta');
  });

  it('tira as tags HTML da descrição', () => {
    const xml = rss(`<item><title>T</title><link>https://x.com/a</link>
      <description><![CDATA[<p>Chuva <b>forte</b> no Araguaia</p>]]></description></item>`);
    expect(parseFeed(xml)[0].resumo).toBe('Chuva forte no Araguaia');
  });

  it('acha a imagem no <img> da descrição quando não há media:content', () => {
    const xml = rss(`<item><title>T</title><link>https://x.com/a</link>
      <description><![CDATA[<img src="https://x.com/foto.jpg">Texto]]></description></item>`);
    expect(parseFeed(xml)[0].imagem).toBe('https://x.com/foto.jpg');
  });

  it('mantém o item sem data, com publicadoEm null', () => {
    const xml = rss(`<item><title>Sem data</title><link>https://x.com/a</link></item>`);
    expect(parseFeed(xml)[0].publicadoEm).toBeNull();
  });

  it('descarta item sem título ou sem link — card sem destino não existe', () => {
    const xml = rss(`<item><title>Só título</title></item><item><link>https://x.com/a</link></item>`);
    expect(parseFeed(xml)).toEqual([]);
  });

  it('ignora link que não é http(s)', () => {
    const xml = rss(`<item><title>T</title><link>javascript:alert(1)</link></item>`);
    expect(parseFeed(xml)).toEqual([]);
  });
});

describe('parseFeed — Atom', () => {
  it('lê <entry> e pega o link do atributo href', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title>Milho no Pará</title>
        <link rel="alternate" href="https://veiculo.com/milho" />
        <published>2026-07-14T09:00:00Z</published>
        <summary>Saca a R$ 66,60</summary>
      </entry></feed>`;
    expect(parseFeed(xml)).toEqual([{
      titulo: 'Milho no Pará',
      link: 'https://veiculo.com/milho',
      publicadoEm: '2026-07-14T09:00:00.000Z',
      resumo: 'Saca a R$ 66,60',
      imagem: null,
    }]);
  });
});

describe('parseFeed — resiliência', () => {
  it('XML quebrado, vazio ou não-XML devolve [] em vez de estourar', () => {
    // A home inteira depende disso: um feed podre não pode virar erro 500.
    expect(parseFeed('<rss><channel><item><title>quebra')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
    expect(parseFeed('<html><body>bloqueado</body></html>')).toEqual([]);
  });
});

describe('decodificar', () => {
  it('resolve entidade nomeada, numérica e hexadecimal', () => {
    expect(decodificar('Boi &amp; vaca')).toBe('Boi & vaca');
    expect(decodificar('Pre&#231;o')).toBe('Preço');
    expect(decodificar('Pre&#xE7;o')).toBe('Preço');
  });

  it('resolve entidade codificada duas vezes — comum em feed de portal', () => {
    expect(decodificar('&amp;quot;Boi China&amp;quot;')).toBe('"Boi China"');
  });
});

describe('limparResumo', () => {
  it('tira o carimbo do WordPress em inglês e em português', () => {
    // Apareceu no destaque da home: o resumo repetia a manchete inteira embaixo dela.
    expect(limparResumo('Impacto chega a US$ 7,4 bilhões. The post Nova tarifa dos EUA afetará 18% appeared first on InfoMoney .'))
      .toBe('Impacto chega a US$ 7,4 bilhões.');
    expect(limparResumo('Documento revisa a estimativa. O post Boletim Macrofiscal mantém PIB apareceu primeiro em Canal Rural.'))
      .toBe('Documento revisa a estimativa.');
  });

  it('tira reticências e "Leia mais" do fim', () => {
    expect(limparResumo('A arroba subiu em Marabá [...]')).toBe('A arroba subiu em Marabá');
    expect(limparResumo('A arroba subiu em Marabá Leia mais')).toBe('A arroba subiu em Marabá');
  });

  it('não mexe num resumo limpo', () => {
    expect(limparResumo('A arroba do boi subiu 2% em Redenção.')).toBe('A arroba do boi subiu 2% em Redenção.');
  });
});

describe('dataDeFeed', () => {
  it('aceita RFC 822 e ISO', () => {
    expect(dataDeFeed('Wed, 15 Jul 2026 10:22:00 -0300')).toBe('2026-07-15T13:22:00.000Z');
    expect(dataDeFeed('2026-07-14T09:00:00Z')).toBe('2026-07-14T09:00:00.000Z');
  });

  it('recusa data inválida e data no futuro (relógio errado do veículo)', () => {
    expect(dataDeFeed('ontem')).toBeNull();
    expect(dataDeFeed(null)).toBeNull();
    const daquiUmAno = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    expect(dataDeFeed(daquiUmAno)).toBeNull();
  });
});

describe('categoria', () => {
  it('classifica pecuária, grãos, mercado e clima', () => {
    expect(categoria(item({ titulo: 'Arroba do boi gordo sobe' }))).toBe('pecuaria');
    expect(categoria(item({ titulo: 'Colheita da soja avança em MT' }))).toBe('graos');
    expect(categoria(item({ titulo: 'Dólar fecha em queda' }))).toBe('mercado');
    expect(categoria(item({ titulo: 'Chuva volta ao Vale do Araguaia' }))).toBe('clima');
  });

  it('sem palavra do ramo, cai em geral', () => {
    expect(categoria(item({ titulo: 'Novo shopping abre em Belém' }))).toBe('geral');
  });

  it('boi com dólar no título é pecuária, não mercado', () => {
    // Para quem cria boi, a notícia é sobre o boi — o dólar é o contexto.
    expect(categoria(item({ titulo: 'Boi gordo sobe com dólar em alta' }))).toBe('pecuaria');
  });
});

describe('relevante', () => {
  it('passa o que é do ramo', () => {
    expect(relevante(item({ titulo: 'Preço da soja dispara' }))).toBe(true);
    expect(relevante(item({ titulo: 'Atriz lança filme novo' }))).toBe(false);
  });

  it('não confunde palavra dentro de outra palavra', () => {
    // 'ouro' dentro de 'tesouro' e 'boi' dentro de 'boinas' fariam a home encher de lixo.
    expect(relevante(item({ titulo: 'Tesouro Direto muda regras' }))).toBe(false);
    expect(relevante(item({ titulo: 'Loja de boinas fecha' }))).toBe(false);
  });

  it('barra o lixo que os feeds reais tentaram passar', () => {
    // Estes três entraram de verdade numa checagem contra os feeds em 16/07/2026.
    // Futebol ('campo'), JCP ('juros') e PIB ('previsão') não são notícia da praça.
    expect(relevante(item({ titulo: 'Vitória x Vasco: escalações e onde assistir ao Brasileirão' }))).toBe(false);
    expect(relevante(item({ titulo: 'Telefônica Brasil (VIVT3) aprova R$ 500 milhões em JCP' }))).toBe(false);
    expect(relevante(item({ titulo: 'Boletim Macrofiscal eleva previsão do PIB de 2026' }))).toBe(false);
  });

  it('não barra o mercado que a praça acompanha', () => {
    expect(relevante(item({ titulo: 'Dólar fecha em alta' }))).toBe(true);
    expect(relevante(item({ titulo: 'Ouro renova máxima histórica' }))).toBe(true);
    expect(relevante(item({ titulo: 'Exportação de carne bovina cresce' }))).toBe(true);
  });

  it('acha a palavra no resumo, não só no título', () => {
    expect(relevante(item({ titulo: 'Mercado reage', resumo: 'A saca de milho subiu' }))).toBe(true);
  });

  // ------------------------------------------------------------------
  // O veículo de nicho DEIXOU de passar direto (23/07/2026).
  //
  // Enquanto `nicho: true` dispensava o filtro, a home recebia lifestyle e
  // celebridade de sites de agro. Todos os títulos abaixo saíram dos feeds reais
  // naquele dia — o dono pediu o recorte "mercado e produção".
  // ------------------------------------------------------------------
  it('barra o lifestyle que vinha dos veículos de agro', () => {
    expect(relevante(item({ titulo: 'Angelina Jolie trocou Hollywood pelas colmeias em projeto que já protege milhões de abelhas' }))).toBe(false);
    expect(relevante(item({ titulo: 'Como montar uma horta em casa' }))).toBe(false);
    expect(relevante(item({ titulo: 'Menores que um pônei, mini-horses conquistam brasileiros e são criados como pets' }))).toBe(false);
    expect(relevante(item({ titulo: 'Quer criar minhocas? Veja guia para iniciantes' }))).toBe(false);
    expect(relevante(item({ titulo: 'Receita Nosso Campo: aprenda a fazer um delicioso cupim casqueirado' }))).toBe(false);
    expect(relevante(item({ titulo: 'Cidade espanhola presenteia campeões da Copa com tomates equivalentes ao próprio peso; veja vídeo' }))).toBe(false);
    expect(relevante(item({ titulo: 'Por que ovos de codorna têm manchas e cores diferentes? Entenda' }))).toBe(false);
  });

  it('deixa passar a notícia de mercado e de produção dos mesmos veículos', () => {
    expect(relevante(item({ titulo: 'Arroba do boi gordo: cotações seguem em alta com escalas de abate em baixa' }))).toBe(true);
    expect(relevante(item({ titulo: 'Demanda aquecida no mercado de soja segura preços firmes' }))).toBe(true);
    expect(relevante(item({ titulo: 'CMN regulamenta renegociação de dívidas rurais e fixa prazo' }))).toBe(true);
    expect(relevante(item({ titulo: 'Temporais castigam cafezais e produtores aceleram colheita para salvar a safra' }))).toBe(true);
    expect(relevante(item({ titulo: 'Câmara aprova anistia a multas de caminhoneiros e reforça piso do frete' }))).toBe(true);
    expect(relevante(item({ titulo: 'Mapa desmente nova tarifa da China sobre carne bovina brasileira' }))).toBe(true);
  });

  it('clima sozinho não basta: foguete e conta de luz não são notícia da praça', () => {
    // Os dois entraram de verdade em 23/07/2026 só porque diziam 'clima'/'El Niño'.
    // Clima que interessa aqui vem colado em safra, lavoura ou produtor — e é por
    // essas palavras que ele entra. 'clima' segue valendo para a CATEGORIA.
    expect(relevante(item({ titulo: 'Starship 13 é adiado novamente por causa do clima; veja nova data' }))).toBe(false);
    expect(relevante(item({ titulo: 'El Niño: governo antecipa contratos de reserva de energia' }))).toBe(false);
    expect(relevante(item({ titulo: 'Seca castiga a lavoura no Tocantins' }))).toBe(true);
  });

  it('barra entretenimento mesmo quando a palavra do agro aparece', () => {
    // 'A Fazenda' é reality show; 'boi' vira nome de bloco de carnaval. A palavra
    // do ramo sozinha não pode abrir a porta para a página de entretenimento.
    expect(relevante(item({ titulo: 'A Fazenda 17: peão é expulso após briga no reality' }))).toBe(false);
    expect(relevante(item({ titulo: 'Novela sobre uma fazenda estreia hoje na TV' }))).toBe(false);
    expect(relevante(item({ titulo: 'Boi Bumbá: veja a escalação dos artistas do festival' }))).toBe(false);
  });
});

describe('internacional', () => {
  it('marca país e ator estrangeiro explícito', () => {
    expect(internacional(item({ titulo: 'China suspende compra de carne brasileira' }))).toBe(true);
    expect(internacional(item({ titulo: 'Tarifa dos EUA atinge o agro' }))).toBe(true);
    expect(internacional(item({ titulo: 'União Europeia muda regra de antimicrobianos' }))).toBe(true);
  });

  it('não marca a notícia de casa', () => {
    expect(internacional(item({ titulo: 'Boi gordo sobe em Redenção' }))).toBe(false);
  });

  it('exportação sozinha não é notícia de fora', () => {
    // 'exportacao' marcava 23 de 40 notícias nos feeds reais: exportar é o dia a
    // dia do agro brasileiro, e um selo em mais da metade da página não informa.
    expect(internacional(item({ titulo: 'Exportação de carne bovina cresce 12%' }))).toBe(false);
  });

  it('convive com a categoria em vez de disputar com ela', () => {
    // A notícia da China sobre carne é PECUÁRIA — é onde o pecuarista procura —
    // e leva o selo de internacional junto.
    const noticia = item({ titulo: 'China suspende compra de carne bovina' });
    expect(categoria(noticia)).toBe('pecuaria');
    expect(internacional(noticia)).toBe(true);
  });
});

describe('extrairOgImage', () => {
  it('lê og:image nas duas ordens de atributo', () => {
    expect(extrairOgImage('<meta property="og:image" content="https://v.com/a.jpg">')).toBe('https://v.com/a.jpg');
    expect(extrairOgImage('<meta content="https://v.com/b.jpg" property="og:image">')).toBe('https://v.com/b.jpg');
  });

  it('cai para twitter:image quando não há og:image', () => {
    expect(extrairOgImage('<meta name="twitter:image" content="https://v.com/c.jpg">')).toBe('https://v.com/c.jpg');
  });

  it('desescapa &amp; da URL', () => {
    expect(extrairOgImage('<meta property="og:image" content="https://v.com/a.jpg?w=1&amp;h=2">'))
      .toBe('https://v.com/a.jpg?w=1&h=2');
  });

  it('recusa URL relativa ou ausente — não resolveria no nosso domínio', () => {
    expect(extrairOgImage('<meta property="og:image" content="/local.jpg">')).toBeNull();
    expect(extrairOgImage('<html><head></head></html>')).toBeNull();
  });
});

describe('completarImagens', () => {
  const noticia = (id: string, imagem: string | null): Noticia => ({
    id, titulo: 'Boi gordo sobe', link: `https://v.com/${id}`, publicadoEm: null,
    resumo: null, imagem, veiculo: 'BeefPoint', categoria: 'pecuaria', internacional: false,
  });

  const respondeHtml = (html: string) =>
    (async () => ({
      ok: true,
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(html)); c.close(); } }),
    }) as unknown as Response) as unknown as typeof fetch;

  it('busca a og:image só das que estão sem foto', async () => {
    // Money Times e BeefPoint não publicam imagem nenhuma no feed (apurado em
    // 16/07/2026) e o BeefPoint é a única fonte só de pecuária que temos.
    const fetchImpl = vi.fn(respondeHtml('<meta property="og:image" content="https://v.com/og.jpg">')) as unknown as typeof fetch;
    const r = await completarImagens([noticia('a', 'https://v.com/ja-tem.jpg'), noticia('b', null)], fetchImpl);

    expect(r[0].imagem).toBe('https://v.com/ja-tem.jpg'); // intocada
    expect(r[1].imagem).toBe('https://v.com/og.jpg');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // só a que faltava
  });

  it('veículo fora do ar deixa a notícia sem foto, mas não derruba a página', async () => {
    const fetchImpl = (async () => { throw new Error('timeout'); }) as unknown as typeof fetch;
    const r = await completarImagens([noticia('b', null)], fetchImpl);
    expect(r[0].imagem).toBeNull();
    expect(r[0].titulo).toBe('Boi gordo sobe');
  });

  it('sem nenhuma faltando, não toca a rede', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await completarImagens([noticia('a', 'https://v.com/x.jpg')], fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('normalizarLink', () => {
  it('tira utm, www, barra final e hash', () => {
    expect(normalizarLink('https://www.g1.globo.com/boi/?utm_source=rss&fbclid=x#topo'))
      .toBe('g1.globo.com/boi');
  });

  it('preserva query que faz parte da matéria', () => {
    expect(normalizarLink('https://veiculo.com/nota?id=42')).toBe('veiculo.com/nota?id=42');
  });

  it('link inválido não estoura', () => {
    expect(normalizarLink('nao-e-url')).toBe('nao-e-url');
  });
});

describe('normalizarTitulo', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(normalizarTitulo('Preço do BOI, gordo!')).toBe('preco do boi gordo');
  });
});

describe('agregar', () => {
  it('junta os feeds e ordena do mais novo para o mais velho', () => {
    const r = agregar([
      { feed: feed({ veiculo: 'G1' }), itens: [item({ titulo: 'Boi velho', link: 'https://a.com/1', publicadoEm: '2026-07-10T00:00:00Z' })] },
      { feed: feed({ id: 'cr', veiculo: 'Canal Rural' }), itens: [item({ titulo: 'Boi novo', link: 'https://b.com/2', publicadoEm: '2026-07-15T00:00:00Z' })] },
    ]);
    expect(r.map((n) => n.titulo)).toEqual(['Boi novo', 'Boi velho']);
    expect(r[0].veiculo).toBe('Canal Rural');
  });

  it('deduplica a mesma matéria vinda com utm diferente', () => {
    // Os dois títulos precisam ser do agro: com um título irrelevante, o teste
    // passaria pelo filtro de relevância e não provaria dedupe nenhum.
    const r = agregar([
      { feed: feed(), itens: [item({ titulo: 'Boi gordo sobe', link: 'https://g1.globo.com/boi?utm_source=a' })] },
      { feed: feed({ id: 'x', veiculo: 'Outro' }), itens: [item({ titulo: 'Arroba da soja cai', link: 'https://www.g1.globo.com/boi/?utm_source=b' })] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toBe('Boi gordo sobe');
  });

  it('deduplica o mesmo fato republicado por dois veículos', () => {
    const r = agregar([
      { feed: feed({ veiculo: 'G1' }), itens: [item({ titulo: 'Boi gordo sobe em MT', link: 'https://a.com/1' })] },
      { feed: feed({ id: 'r7', veiculo: 'R7' }), itens: [item({ titulo: 'BOI GORDO SOBE EM MT!', link: 'https://b.com/2' })] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].veiculo).toBe('G1'); // o primeiro a publicar fica
  });

  it('joga fora o irrelevante, venha do veículo que vier', () => {
    // O filtro passou a valer também para o veículo de agro (23/07/2026): era por
    // ali que entrava lifestyle.
    const r = agregar([
      { feed: feed(), itens: [item({ titulo: 'Novela estreia hoje', link: 'https://a.com/1' })] },
      { feed: feed({ id: 'cr', veiculo: 'Canal Rural' }), itens: [item({ titulo: 'Leilão de gado na cooperativa', link: 'https://b.com/2' })] },
      { feed: feed({ id: 'gr', veiculo: 'Globo Rural' }), itens: [item({ titulo: 'Como montar uma horta em casa', link: 'https://c.com/3' })] },
    ]);
    expect(r.map((n) => n.titulo)).toEqual(['Leilão de gado na cooperativa']);
  });

  it('item sem data vai para o fim, mas não some', () => {
    const r = agregar([
      { feed: feed(), itens: [
        item({ titulo: 'Boi sem data', link: 'https://a.com/1', publicadoEm: null }),
        item({ titulo: 'Boi com data', link: 'https://a.com/2', publicadoEm: '2026-07-01T00:00:00Z' }),
      ] },
    ]);
    expect(r.map((n) => n.titulo)).toEqual(['Boi com data', 'Boi sem data']);
  });

  it('respeita o limite', () => {
    const itens = Array.from({ length: 60 }, (_, i) =>
      item({ titulo: `Boi ${i}`, link: `https://a.com/${i}` }));
    expect(agregar([{ feed: feed(), itens }], 40)).toHaveLength(40);
  });

  it('sem feed nenhum devolve [] — a página mostra vazio, não quebra', () => {
    expect(agregar([])).toEqual([]);
  });

  it('nenhum veículo passa do teto quando há material de sobra', () => {
    // Contra os feeds reais, InfoMoney e CNN tomaram 17 de 40 vagas e o G1
    // Agronegócios entrou com UMA — numa página feita para quem cria boi.
    // Em produção são 10 feeds: 10 x 6 = 60 candidatos para 40 vagas, então o teto
    // morde. O cenário aqui espelha isso (8 veículos x 10 itens para 40 vagas).
    const colhidos = Array.from({ length: 8 }, (_, v) => ({
      feed: feed({ id: `v${v}`, veiculo: `Veículo ${v}` }),
      itens: Array.from({ length: 10 }, (_, i) =>
        item({ titulo: `Boi ${v}-${i}`, link: `https://v${v}.com/${i}`, publicadoEm: `2026-07-15T${String(i).padStart(2, '0')}:00:00Z` })),
    }));

    const r = agregar(colhidos, 40);
    const porVeiculo = new Map<string, number>();
    for (const n of r) porVeiculo.set(n.veiculo, (porVeiculo.get(n.veiculo) ?? 0) + 1);

    expect(r).toHaveLength(40);
    expect(Math.max(...porVeiculo.values())).toBeLessThanOrEqual(LIMITE_POR_VEICULO);
  });

  it('o veículo pequeno com notícia fresca entra mesmo contra uma enxurrada', () => {
    const enxurrada = Array.from({ length: 50 }, (_, i) =>
      item({ titulo: `Boi urgente ${i}`, link: `https://cnn.com/${i}`, publicadoEm: '2026-07-15T12:00:00Z' }));
    const pequeno = [item({ titulo: 'Arroba do boi em Redenção', link: 'https://beefpoint.com/1', publicadoEm: '2026-07-15T11:00:00Z' })];

    const r = agregar([
      { feed: feed({ id: 'cnn', veiculo: 'CNN' }), itens: enxurrada },
      { feed: feed({ id: 'bp', veiculo: 'BeefPoint' }), itens: pequeno },
    ], 40);

    expect(r.some((n) => n.veiculo === 'BeefPoint')).toBe(true);
  });

  it('com poucos veículos vivos, a sobra preenche a página', () => {
    // Se metade dos feeds cair, é melhor 10 notícias de um veículo do que 6 e um buraco.
    const itens = Array.from({ length: 20 }, (_, i) =>
      item({ titulo: `Boi ${i}`, link: `https://a.com/${i}` }));
    expect(agregar([{ feed: feed(), itens }], 10)).toHaveLength(10);
  });
});

describe('FEEDS (invariante do registry)', () => {
  it('todo feed tem id único, veículo e URL https', () => {
    const ids = FEEDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FEEDS) {
      expect(f.veiculo.length).toBeGreaterThan(0);
      expect(f.url).toMatch(/^https:\/\//);
    }
  });
});
