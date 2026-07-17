import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsePagina,
  buscarPorUfPecuaria,
  buscarNovilha,
  buscarBezerro,
  resetCachePecuaria,
} from '@/lib/fontes/pecuaria';

// HTML real capturado das páginas (bezerro em 13-14/07/2026; novilha em 16/07/2026)
// — se o site mudar a estrutura, estes testes continuam passando, mas a coleta em
// produção falha alto. É por isso que o parse devolve null em vez de inventar valor.
//
// A fixture da vaca saiu na fatia 17: a vaca não vem mais daqui (é da Scot por
// praça, em lib/fontes/scot.ts) e a novilha trocou de gorda/Datagro para
// reposição/Scot. Ambas são reposição em R$/cabeça agora — sem coluna de variação.
const fixture = (nome: string) => readFileSync(join(process.cwd(), 'tests', 'fixtures', nome), 'utf-8');
const HTML_NOVILHA = fixture('na-novilha.html');
const HTML_BEZERRO = fixture('na-bezerro.html');

const respostaOk = (html: string) => ({ ok: true, status: 200, text: async () => html }) as unknown as Response;

beforeEach(() => resetCachePecuaria());

describe('parsePagina', () => {
  it('lê a novilha: Araguaia primeiro, BA/MA de referência depois', () => {
    const r = parsePagina(HTML_NOVILHA, false);
    expect(r).not.toBeNull();
    // BA e MA entraram como referência na fatia 17 — depois do Araguaia, nunca antes.
    expect(r!.ufs.map((u) => u.uf)).toEqual(['PA', 'MT', 'TO', 'GO', 'BA', 'MA']);
    // R$/cabeça: reposição não se negocia por arroba.
    expect(r!.ufs.find((u) => u.uf === 'PA')).toEqual({ uf: 'PA', valor: 3050, variacaoPct: null });
    expect(r!.ufs.find((u) => u.uf === 'MT')?.valor).toBe(3089);
  });

  it('usa o fechamento mais recente (a página traz o histórico embaixo)', () => {
    expect(parsePagina(HTML_NOVILHA, false)!.dataReferencia).toBe('2026-07-16T03:00:00.000Z');
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
    const precos = await buscarPorUfPecuaria('novilha', async () => respostaOk(HTML_NOVILHA));
    expect(precos).toHaveLength(6);
    expect(precos[0]).toEqual({
      tipo: 'novilha',
      uf: 'PA',
      valor: 3050,
      unidade: 'R$/cab',
      variacaoPct: null,
      dataReferencia: '2026-07-16T03:00:00.000Z',
    });
  });

  it('bezerro sai em R$/cab', async () => {
    const precos = await buscarPorUfPecuaria('bezerro', async () => respostaOk(HTML_BEZERRO));
    expect(precos.every((p) => p.unidade === 'R$/cab')).toBe(true);
  });
});

describe('buscarNovilha / buscarBezerro (valor único do histórico)', () => {
  it('é a média das UFs da praça — o mesmo critério do boi', async () => {
    const c = await buscarNovilha(async () => respostaOk(HTML_NOVILHA));
    // (3050 + 3089 + 3010 + 3000 + 2707,50 + 2970) / 6
    expect(c.valor).toBe(2971.08);
    expect(c).toMatchObject({ tipo: 'novilha', unidade: 'R$/cab', fonte: 'scot' });
  });

  it('a novilha e o bezerro são creditados à Scot, os dois em R$/cabeça', async () => {
    // Reposição virou família única na fatia 17: bezerro 12 meses, novilha 18 meses.
    const bezerro = await buscarBezerro(async () => respostaOk(HTML_BEZERRO));
    expect(bezerro).toMatchObject({ fonte: 'scot', unidade: 'R$/cab' });
  });

  it('estoura quando a página responde erro — nunca grava valor velho como novo', async () => {
    const erro = { ok: false, status: 503 } as unknown as Response;
    await expect(buscarNovilha(async () => erro)).rejects.toThrow('503');
  });
});
