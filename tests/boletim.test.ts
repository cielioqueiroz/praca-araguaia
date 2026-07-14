import { describe, it, expect } from 'vitest';
import { montarBoletim } from '@/lib/boletim';
import type { PrecoUf } from '@/types/cotacao';

const linha = (tipo: string, valor: number, unidade: string, variacao_pct: number | null) => ({
  tipo, valor, unidade, variacao_pct,
});

const uf = (tipo: string, sigla: string, valor: number, variacaoPct: number | null): PrecoUf => ({
  tipo,
  uf: sigla,
  valor,
  unidade: tipo === 'boi' ? 'R$/@' : 'R$/sc 60kg',
  variacaoPct,
  dataReferencia: '2026-07-03T03:00:00.000Z',
});

describe('montarBoletim', () => {
  it('separa a porteira (com o preço de cada estado) do mercado', () => {
    const b = montarBoletim(
      [
        linha('dolar', 5.1072, 'R$', 0.11),
        linha('boi', 321.26, 'R$/@', -1.74),
        linha('bitcoin', 326732, 'R$', 0.02),
      ],
      [uf('boi', 'PA', 329.55, -3), uf('boi', 'MT', 319.2, -0.75)],
    );

    expect(b.porteira.map((p) => p.titulo)).toEqual(['Boi gordo']);
    expect(b.porteira[0].ufs).toEqual([
      { nome: 'Pará', valorFmt: '329,55', variacao: { texto: '3%', direcao: 'baixa' } },
      { nome: 'Mato Grosso', valorFmt: '319,20', variacao: { texto: '0,75%', direcao: 'baixa' } },
    ]);
    expect(b.mercado.map((m) => m.titulo)).toEqual(['Dólar', 'Bitcoin']);
  });

  it('formata o ouro em R$ por grama e a cripto sem centavos perdidos', () => {
    const b = montarBoletim(
      [linha('ouro', 678.23, 'R$/g', null), linha('ethereum', 9323.33, 'R$', null)],
      [],
    );
    expect(b.mercado[0].valorFmt).toBe('R$ 678,23 /g');
    expect(b.mercado[1].valorFmt).toBe('R$ 9.323,33');
  });

  it('mantém o câmbio com 4 casas', () => {
    const b = montarBoletim([linha('dolar', 5.1945, 'R$', null)], []);
    expect(b.mercado[0].valorFmt).toBe('R$ 5,1945');
  });

  it('monta variação com direção; null fica sem variação; 0 conta como alta', () => {
    const b = montarBoletim(
      [linha('dolar', 5, 'R$', 0.4), linha('euro', 6, 'R$', -1.54), linha('ouro', 678, 'R$/g', null), linha('bitcoin', 1, 'R$', 0)],
      [],
    );
    expect(b.mercado[0].variacao).toEqual({ texto: '0,4%', direcao: 'alta' });
    expect(b.mercado[1].variacao).toEqual({ texto: '1,54%', direcao: 'baixa' });
    expect(b.mercado[2].variacao).toBeUndefined();
    expect(b.mercado[3].variacao).toEqual({ texto: '0%', direcao: 'alta' });
  });

  it('a commodity sem preço por estado não entra na porteira (nada de média disfarçada)', () => {
    const b = montarBoletim([linha('milho', 51.75, 'R$/sc 60kg', 0)], []);
    expect(b.porteira).toEqual([]);
  });

  it('rotula a CONAB pelo intervalo da semana (segunda a sexta) e credita a fonte', () => {
    const b = montarBoletim([], [uf('soja', 'TO', 112.2, 2.19)]);
    expect(b.porteira[0].rodape).toBe('CONAB · semana de 29/06 a 03/07');
  });

  // Datagro e Scot fecham por DIA — rotular de "semana" seria mentir na data.
  it('rotula os indicadores diários pelo dia do fechamento', () => {
    const b = montarBoletim([], [uf('vaca', 'PA', 298.36, 0.13)]);
    expect(b.porteira[0].rodape).toBe('Datagro · 03/07');

    const c = montarBoletim([], [uf('bezerro', 'MT', 3546.23, null)]);
    expect(c.porteira[0].rodape).toBe('Scot Consultoria · 03/07');
  });

  it('data por extenso em pt-BR no fuso do Araguaia', () => {
    const b = montarBoletim([], [], [], new Date('2026-07-03T14:00:00Z'));
    expect(b.dataExtenso).toBe('sexta-feira, 3 de julho de 2026');
  });

  // O Postgres devolve as linhas na ordem que quiser.
  it('lista os estados sempre na ordem da praça (PA/MT/TO/GO), venha o banco como vier', () => {
    const b = montarBoletim([], [
      uf('vaca', 'GO', 297.64, 0.14),
      uf('vaca', 'TO', 291.32, -0.03),
      uf('vaca', 'PA', 298.36, 0.13),
      uf('vaca', 'MT', 286.16, -0.25),
    ]);
    expect(b.porteira[0].ufs.map((u) => u.nome)).toEqual(['Pará', 'Mato Grosso', 'Tocantins', 'Goiás']);
  });

  // O Termômetro agora vale para toda a porteira, não só para o boi.
  it('pendura as cidades no produto certo, e só as que têm reporte', () => {
    const b = montarBoletim([], [uf('vaca', 'PA', 298.36, 0.13), uf('boi', 'PA', 325.95, -1.09)], [
      { produto: 'vaca', municipio: 'Redenção', uf: 'PA', mediana: 305, contagem: 3 },
      { produto: 'vaca', municipio: 'Confresa', uf: 'MT', mediana: null, contagem: 0 },
      { produto: 'boi', municipio: 'Vila Rica', uf: 'MT', mediana: 318.5, contagem: 2 },
    ]);

    const vaca = b.porteira.find((p) => p.tipo === 'vaca')!;
    // Confresa não tem reporte de vaca: não entra no card (lá o convite não cabe).
    expect(vaca.cidades).toEqual([
      { municipio: 'Redenção', uf: 'PA', valorFmt: '305,00', contagem: 3 },
    ]);

    // O reporte do boi não vaza para a vaca.
    expect(b.porteira.find((p) => p.tipo === 'boi')!.cidades).toEqual([
      { municipio: 'Vila Rica', uf: 'MT', valorFmt: '318,50', contagem: 2 },
    ]);
    expect(b.semReportes).toBe(false);
  });

  it('sem nenhum reporte, marca semReportes (o card faz o convite em uma linha)', () => {
    const b = montarBoletim([], [uf('boi', 'PA', 325.95, null)], [
      { produto: 'boi', municipio: 'Redenção', uf: 'PA', mediana: null, contagem: 0 },
    ]);
    expect(b.semReportes).toBe(true);
    expect(b.porteira[0].cidades).toEqual([]);
  });

  it('sem dado nenhum devolve as colunas vazias sem quebrar', () => {
    const b = montarBoletim([], []);
    expect(b.porteira).toEqual([]);
    expect(b.mercado).toEqual([]);
    expect(b.dataExtenso.length).toBeGreaterThan(0);
  });
});
