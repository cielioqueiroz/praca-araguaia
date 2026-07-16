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
  <tr><td>GO Reg. Sul</td><td>311,50</td><td>315,00</td><td>294,50</td></tr>
  <tr><td>RS Oeste (kg)</td><td>12,35</td><td>12,50</td><td>11,35</td></tr>
  <tr><td>MT Norte</td><td>311,50</td><td>315,00</td><td>291,50</td></tr>
  <tr><td>MT Cuiabá*</td><td>313,50</td><td>317,00</td><td>287,00</td></tr>
  <tr><td>SC</td><td>338,00</td><td>342,00</td><td>311,50</td></tr>
  <tr><td>PA Marabá</td><td>300,00</td><td>304,00</td><td>280,00</td></tr>
  <tr><td>PA Redenção</td><td>302,00</td><td>306,00</td><td>282,00</td></tr>
  <tr><td>PA Paragominas</td><td>298,00</td><td>302,00</td><td>278,00</td></tr>
  <tr><td>TO Norte</td><td>305,00</td><td>309,00</td><td>285,00</td></tr>
  <tr><td>TO Sul</td><td>307,00</td><td>311,00</td><td>287,00</td></tr>
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

  it('fica só com as praças da região, na ordem de casa', () => {
    const l = parseScot(HTML)!.linhas;
    expect(l.map((x) => `${x.uf} ${x.praca}`)).toEqual([
      'PA Marabá', 'PA Redenção', 'PA Paragominas',
      'TO Norte', 'TO Sul',
      'MT Norte', 'MT Cuiabá',
      'GO Goiânia', 'GO Região Sul',
    ]);
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
    expect(precos[1]).toEqual({
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
    // Marabá, Redenção, Cuiabá e Goiânia sumiram de verdade numa versão anterior
    // (decoder errado). São justamente as praças de casa: valem um teste próprio.
    const precos = await buscarPorPracaScot('boi', respondeCom(HTML));
    expect(precos.map((p) => p.praca)).toEqual(
      expect.arrayContaining(['Marabá', 'Redenção', 'Cuiabá', 'Goiânia']),
    );
  });
});

describe('buscarMediaScot', () => {
  it('faz a média das praças da região para o gráfico', async () => {
    const c = await buscarMediaScot('boi', respondeCom(HTML));
    // (300+302+298+305+307+311,50+313,50+311,50+311,50) / 9
    expect(c).toMatchObject({ tipo: 'boi', unidade: 'R$/@', fonte: 'scot' });
    expect(c.valor).toBeCloseTo(306.67, 1);
  });
});
