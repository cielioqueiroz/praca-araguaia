import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsePagina,
  buscarPorUfPecuaria,
  buscarVaca,
  buscarBezerro,
  resetCachePecuaria,
} from '@/lib/fontes/pecuaria';

// HTML real capturado das páginas (13-14/07/2026) — se o site mudar a estrutura,
// estes testes continuam passando, mas a coleta em produção falha alto. É por isso
// que o parse devolve null em vez de inventar valor.
const fixture = (nome: string) => readFileSync(join(process.cwd(), 'tests', 'fixtures', nome), 'utf-8');
const HTML_VACA = fixture('na-vaca.html');
const HTML_BEZERRO = fixture('na-bezerro.html');

const respostaOk = (html: string) => ({ ok: true, status: 200, text: async () => html }) as unknown as Response;

beforeEach(() => resetCachePecuaria());

describe('parsePagina', () => {
  it('lê a vaca: só as UFs da praça, na ordem PA/MT/TO/GO, com a variação', () => {
    const r = parsePagina(HTML_VACA, true);
    expect(r).not.toBeNull();
    expect(r!.ufs.map((u) => u.uf)).toEqual(['PA', 'MT', 'TO', 'GO']);
    expect(r!.ufs.find((u) => u.uf === 'MT')).toEqual({ uf: 'MT', valor: 286.16, variacaoPct: -0.25 });
    // 'Para' vem sem acento na página — tem de virar PA do mesmo jeito.
    expect(r!.ufs.find((u) => u.uf === 'PA')?.valor).toBe(298.36);
  });

  it('usa o fechamento mais recente (a página traz o histórico embaixo)', () => {
    // Primeiro fechamento do arquivo: 10/07/2026, à meia-noite de Brasília.
    expect(parsePagina(HTML_VACA, true)!.dataReferencia).toBe('2026-07-10T03:00:00.000Z');
  });

  it('lê o bezerro em R$/cabeça e não confunde a coluna de R$/kg com variação', () => {
    const r = parsePagina(HTML_BEZERRO, false);
    const mt = r!.ufs.find((u) => u.uf === 'MT');
    expect(mt!.valor).toBe(3546.23); // R$/cabeça, com o separador de milhar
    expect(mt!.variacaoPct).toBeNull(); // 14,78 é o R$/kg, não a variação
  });

  it('devolve null quando a tabela não está lá (o HTML mudou)', () => {
    expect(parsePagina('<html><body>manutenção</body></html>', true)).toBeNull();
  });

  it('devolve null quando há tabela mas nenhuma data de fechamento', () => {
    expect(parsePagina('<table class="cot-fisicas"><tr><td>Pará</td><td>300,00</td></tr></table>', true)).toBeNull();
  });

  it('ignora linha sem preço em vez de gravar zero', () => {
    const html = `<div class="fechamento">Fechamento: 13/07/2026</div>
      <table class="cot-fisicas">
        <tr><td>Pará</td><td>***</td><td>0,00</td></tr>
        <tr><td>Tocantins</td><td>291,32</td><td>-0,03</td></tr>
      </table>`;
    const r = parsePagina(html, true);
    expect(r!.ufs.map((u) => u.uf)).toEqual(['TO']);
  });
});

describe('buscarPorUfPecuaria', () => {
  it('devolve o preço de cada UF com a unidade da categoria', async () => {
    const precos = await buscarPorUfPecuaria('vaca', async () => respostaOk(HTML_VACA));
    expect(precos).toHaveLength(4);
    expect(precos[0]).toEqual({
      tipo: 'vaca',
      uf: 'PA',
      valor: 298.36,
      unidade: 'R$/@',
      variacaoPct: 0.13,
      dataReferencia: '2026-07-10T03:00:00.000Z',
    });
  });

  it('bezerro sai em R$/cab', async () => {
    const precos = await buscarPorUfPecuaria('bezerro', async () => respostaOk(HTML_BEZERRO));
    expect(precos.every((p) => p.unidade === 'R$/cab')).toBe(true);
  });
});

describe('buscarVaca / buscarBezerro (valor único do histórico)', () => {
  it('é a média das UFs da praça — o mesmo critério do boi da CONAB', async () => {
    const c = await buscarVaca(async () => respostaOk(HTML_VACA));
    // (298,36 + 286,16 + 291,32 + 297,64) / 4
    expect(c.valor).toBe(293.37);
    expect(c).toMatchObject({ tipo: 'vaca', unidade: 'R$/@', fonte: 'datagro' });
  });

  it('o bezerro é creditado à Scot', async () => {
    const c = await buscarBezerro(async () => respostaOk(HTML_BEZERRO));
    expect(c.fonte).toBe('scot');
    expect(c.unidade).toBe('R$/cab');
  });

  it('estoura quando a página responde erro — nunca grava valor velho como novo', async () => {
    const erro = { ok: false, status: 503 } as unknown as Response;
    await expect(buscarVaca(async () => erro)).rejects.toThrow('503');
  });
});
