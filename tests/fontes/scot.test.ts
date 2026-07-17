import { describe, it, expect, beforeEach } from 'vitest';
import { parseScot, chaveDaLinha, buscarPorPracaScot, buscarMediaScot, resetCacheScot } from '@/lib/fontes/scot';

// Recorte fiel da página (16/07/2026): cabeçalho, praças da região, praças de fora,
// o asterisco do Cuiabá, a linha em kg do RS e a linha 'SC' sem praça.
const HTML = `
<div class="fechamento">Fechamento: 15/07/2026</div>
<table class="cot-fisicas">
  <tr><th>Município</th><th>Boi Gordo - (R$/@ - à vista)</th><th>Boi Gordo - (R$/@ - prazo 30 dias)</th><th>Vaca Gorda (R$/@ - à vista)</th></tr>
  <tr><td>SP Barretos</td><td>326,50</td><td>330,00</td><td>306,50</td></tr>
  <tr><td>GO Goiânia</td><td>311,50</td><td>315,00</td><td>291,50</td></tr>
  <tr><td>RS Oeste (kg)</td><td>12,35</td><td>12,50</td><td>11,35</td></tr>
  <tr><td>MT Norte</td><td>311,50</td><td>315,00</td><td>291,50</td></tr>
  <tr><td>MT Cuiabá*</td><td>313,50</td><td>317,00</td><td>287,00</td></tr>
  <tr><td>MT Sudeste</td><td>309,00</td><td>313,00</td><td>289,00</td></tr>
  <tr><td>SC</td><td>338,00</td><td>342,00</td><td>311,50</td></tr>
  <tr><td>PA Marabá</td><td>300,00</td><td>304,00</td><td>280,00</td></tr>
  <tr><td>PA Redenção</td><td>302,00</td><td>306,00</td><td>282,00</td></tr>
  <tr><td>PA Paragominas</td><td>298,00</td><td>302,00</td><td>278,00</td></tr>
  <tr><td>TO Norte</td><td>305,00</td><td>309,00</td><td>285,00</td></tr>
  <tr><td>TO Sul</td><td>307,00</td><td>311,00</td><td>287,00</td></tr>
  <tr><td>BA Sul</td><td>306,50</td><td>310,00</td><td>284,00</td></tr>
  <tr><td>BA Oeste</td><td>314,50</td><td>318,00</td><td>284,00</td></tr>
  <tr><td>MA Oeste</td><td>316,50</td><td>320,00</td><td>293,50</td></tr>
  <tr><td>Alagoas</td><td>334,00</td><td>338,00</td><td>316,50</td></tr>
</table>
<table class="cot-fisicas"><tr><td>PA Marabá</td><td>1,00</td><td>1,00</td><td>1,00</td></tr></table>
`;

const respondeCom = (html: string, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, text: async () => html }) as unknown as Response) as unknown as typeof fetch;

beforeEach(() => resetCacheScot());

describe('chaveDaLinha', () => {
  it('separa sigla e praça', () => {
    expect(chaveDaLinha('PA Marabá')).toBe('PA|MARABA');
    expect(chaveDaLinha('GO Reg. Sul')).toBe('GO|REG. SUL');
  });

  it('descarta o asterisco de nota de rodapé da Scot', () => {
    expect(chaveDaLinha('MT Cuiabá*')).toBe('MT|CUIABA');
  });

  it('devolve null quando a linha não tem sigla + praça', () => {
    expect(chaveDaLinha('SC')).toBeNull();
    expect(chaveDaLinha('Alagoas')).toBeNull();
  });
});

describe('parseScot', () => {
  it('lê a data de fechamento', () => {
    expect(parseScot(HTML)!.dataReferencia).toBe('2026-07-15T03:00:00.000Z');
  });

  it('as 3 cidades do Pará e UMA praça de referência por estado, na ordem do dono', () => {
    // As cidades do Pará primeiro; depois um rótulo por estado (MT/TO/GO/BA/MA), com
    // o VALOR da praça de referência daquele estado (MT Norte, TO Norte, GO Goiânia,
    // BA Oeste, MA Oeste). As demais praças do estado — MT Sudeste/Cuiabá, TO Sul,
    // BA Sul, GO Reg. Sul — não entram: eram as linhas repetidas que o dono cortou.
    const l = parseScot(HTML)!.linhas;
    expect(l.map((x) => `${x.uf} ${x.praca}`)).toEqual([
      'PA Marabá', 'PA Paragominas', 'PA Redenção',
      'MT Mato Grosso', 'TO Tocantins', 'GO Goiás', 'BA Bahia', 'MA Maranhão',
    ]);
  });

  it('o valor de cada estado é o da praça de referência (MT = MT Norte)', () => {
    const l = parseScot(HTML)!.linhas;
    const mt = l.find((x) => x.uf === 'MT')!;
    // No HTML, MT Norte = 311,50 (não o Sudeste 309,00 nem o Cuiabá 313,50).
    expect(mt).toMatchObject({ praca: 'Mato Grosso', boi: 311.5 });
    const to = l.find((x) => x.uf === 'TO')!;
    expect(to).toMatchObject({ praca: 'Tocantins', boi: 305 }); // TO Norte, não TO Sul (307)
  });

  it('não deixa entrar praça de fora do recorte', () => {
    const nomes = parseScot(HTML)!.linhas.map((x) => x.praca);
    for (const fora of ['Cuiabá', 'Sudeste', 'Barretos', 'Sul']) {
      expect(nomes, `${fora} não deveria estar na lista`).not.toContain(fora);
    }
  });

  it('lê boi à vista, boi a prazo e vaca de cada praça', () => {
    const redencao = parseScot(HTML)!.linhas.find((l) => l.praca === 'Redenção')!;
    expect(redencao).toMatchObject({ uf: 'PA', boi: 302, boiPrazo: 306, vaca: 282 });
  });

  it('ignora a segunda tabela — é o fechamento antigo', () => {
    const maraba = parseScot(HTML)!.linhas.find((l) => l.praca === 'Marabá')!;
    expect(maraba.boi).toBe(300); // e não 1,00 da tabela de baixo
  });

  it('devolve null quando o HTML muda (sem tabela ou sem data)', () => {
    expect(parseScot('<html>site fora do ar</html>')).toBeNull();
    expect(parseScot('<table class="cot-fisicas"><tr><td>PA Marabá</td><td>300,00</td><td>1</td><td>1</td></tr></table>')).toBeNull();
  });

  it('preço vazio ou *** vira null, nunca zero', () => {
    const html = HTML.replace('<td>302,00</td>', '<td>***</td>');
    const redencao = parseScot(html)!.linhas.find((l) => l.praca === 'Redenção')!;
    expect(redencao.boi).toBeNull();
  });
});

describe('buscarPorPracaScot', () => {
  it('devolve o boi de cada praça em R$/@ com o preço a prazo junto', async () => {
    const precos = await buscarPorPracaScot('boi', respondeCom(HTML));
    expect(precos.find((p) => p.praca === 'Redenção')).toEqual({
      tipo: 'boi', uf: 'PA', praca: 'Redenção', valor: 302, unidade: 'R$/@',
      variacaoPct: null, dataReferencia: '2026-07-15T03:00:00.000Z', valorPrazo: 306,
    });
  });

  it('a vaca não carrega preço a prazo — a Scot não publica', async () => {
    const precos = await buscarPorPracaScot('vaca', respondeCom(HTML));
    expect(precos[0]).not.toHaveProperty('valorPrazo');
    expect(precos[0].valor).toBe(280);
  });

  it('praça sem preço é omitida, não entra com zero', async () => {
    resetCacheScot();
    const precos = await buscarPorPracaScot('boi', respondeCom(HTML.replace('<td>302,00</td>', '<td></td>')));
    expect(precos.some((p) => p.praca === 'Redenção')).toBe(false);
    expect(precos.some((p) => p.praca === 'Marabá')).toBe(true);
  });

  it('estoura quando a fonte responde erro — a coleta trata por tipo', async () => {
    await expect(buscarPorPracaScot('boi', respondeCom('', false))).rejects.toThrow('Scot respondeu 500');
  });

  it('não perde as praças acentuadas', async () => {
    // Marabá e Redenção sumiram de verdade numa versão anterior (decoder errado).
    // São justamente as praças de casa: valem um teste próprio.
    const precos = await buscarPorPracaScot('boi', respondeCom(HTML));
    expect(precos.map((p) => p.praca)).toEqual(expect.arrayContaining(['Marabá', 'Redenção']));
  });
});

describe('buscarMediaScot', () => {
  it('faz a média das praças exibidas para o gráfico', async () => {
    const c = await buscarMediaScot('boi', respondeCom(HTML));
    // 3 cidades do PA + a praça de referência de cada estado:
    // (300+298+302 + 311,50 MT Norte + 305 TO Norte + 311,50 GO Goiânia
    //  + 314,50 BA Oeste + 316,50 MA Oeste) / 8 = 307,375
    expect(c).toMatchObject({ tipo: 'boi', unidade: 'R$/@', fonte: 'scot' });
    expect(c.valor).toBeCloseTo(307.375, 2);
  });
});
