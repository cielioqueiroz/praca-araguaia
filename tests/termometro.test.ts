import { describe, it, expect } from 'vitest';
import { validarReporte, resumirReportes, mediana, normalizarValor, cidadesDoProduto, PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO } from '@/lib/termometro';
import { PORTEIRA } from '@/lib/tipos-ui';

const corpo = (extra: Record<string, unknown> = {}) => ({
  produto: 'boi', municipio: 'Redenção', valor: 320, contato: '', ...extra,
});

describe('validarReporte', () => {
  it('aceita um reporte válido', () => {
    const v = validarReporte(corpo());
    expect(v).toEqual({ tipo: 'valido', reporte: { produto: 'boi', municipio: 'Redenção', valor: 320 } });
  });

  it('detecta honeypot preenchido', () => {
    expect(validarReporte(corpo({ contato: 'zap 99999' }))).toEqual({ tipo: 'honeypot' });
  });

  it('rejeita produto fora da lista', () => {
    const v = validarReporte(corpo({ produto: 'cafe' }));
    expect(v.tipo).toBe('invalido');
  });

  it('rejeita município fora da lista', () => {
    const v = validarReporte(corpo({ municipio: 'Goiânia' }));
    expect(v.tipo).toBe('invalido');
  });

  it('rejeita valor fora da faixa do produto (apontando a faixa)', () => {
    const v = validarReporte(corpo({ valor: 90 }));
    expect(v).toMatchObject({ tipo: 'invalido' });
    if (v.tipo === 'invalido') expect(v.erro).toMatch(/150.*600/);
    const v2 = validarReporte(corpo({ produto: 'bezerro', valor: 7000 }));
    expect(v2.tipo).toBe('invalido');
  });

  it('rejeita valor não numérico ou corpo malformado', () => {
    expect(validarReporte(corpo({ valor: 'trezentos' })).tipo).toBe('invalido');
    expect(validarReporte(null).tipo).toBe('invalido');
    expect(validarReporte('oi').tipo).toBe('invalido');
  });

  it('aceita os limites das faixas (inclusivos)', () => {
    expect(validarReporte(corpo({ valor: 150 })).tipo).toBe('valido');
    expect(validarReporte(corpo({ valor: 600 })).tipo).toBe('valido');
  });
});

describe('mediana', () => {
  it('valor central em contagem ímpar', () => {
    expect(mediana([310, 320, 900])).toBe(320);
  });
  it('média dos dois centrais em contagem par, 2 casas', () => {
    expect(mediana([300, 310, 320, 331])).toBe(315);
    expect(mediana([50, 51])).toBe(50.5);
  });
  it('um elemento é ele mesmo; repetidos ok', () => {
    expect(mediana([320])).toBe(320);
    expect(mediana([320, 320, 320])).toBe(320);
  });
  it('não depende da ordem de entrada', () => {
    expect(mediana([900, 310, 320])).toBe(320);
  });
});

describe('resumirReportes', () => {
  const r = (produto: string, municipio: string, valor: number) => ({ produto, municipio, valor });

  it('agrega mediana regional (imune a um extremo) e faixa, na ordem fixa', () => {
    const resumo = resumirReportes([
      r('soja', 'Vila Rica', 110),
      r('boi', 'Redenção', 300),
      r('boi', 'Redenção', 310),
      r('boi', 'Confresa', 320),
      r('boi', 'Confresa', 330),
      r('boi', 'Vila Rica', 900), // extremo: puxaria a média para ~432
    ]);
    expect(resumo.map((x) => x.produto)).toEqual(['boi', 'soja']); // ordem fixa, sem produtos vazios
    expect(resumo[0]).toMatchObject({ rotulo: 'Boi gordo', unidade: 'R$/@', mediana: 320, contagem: 5 });
    expect(resumo[0].faixa).toEqual({ min: 300, max: 900 });
  });

  it('mediana por município e contagem', () => {
    const resumo = resumirReportes([
      r('boi', 'Redenção', 320),
      r('boi', 'Redenção', 330),
      r('boi', 'Confresa', 310),
    ]);
    expect(resumo[0].municipios).toEqual([
      { municipio: 'Redenção', mediana: 325, contagem: 2 },
      { municipio: 'Confresa', mediana: 310, contagem: 1 },
    ]);
  });

  it('um reporte: mediana = valor, faixa degenerada', () => {
    const resumo = resumirReportes([r('milho', 'Vila Rica', 50)]);
    expect(resumo[0]).toMatchObject({ mediana: 50, contagem: 1 });
    expect(resumo[0].faixa).toEqual({ min: 50, max: 50 });
  });

  it('lista vazia devolve vazio', () => {
    expect(resumirReportes([])).toEqual([]);
  });
});

describe('normalizarValor', () => {
  it('converte separador de milhar pt-BR', () => {
    expect(normalizarValor('1.500')).toBe(1500);
  });

  it('converte milhar com decimal pt-BR', () => {
    expect(normalizarValor('1.500,50')).toBe(1500.5);
  });

  it('converte decimal com vírgula', () => {
    expect(normalizarValor('320,5')).toBe(320.5);
  });

  it('mantém decimal com ponto', () => {
    expect(normalizarValor('320.5')).toBe(320.5);
  });

  it('mantém número inteiro simples', () => {
    expect(normalizarValor('320')).toBe(320);
  });

  it('devolve NaN para texto não numérico', () => {
    expect(normalizarValor('abc')).toBeNaN();
  });
});

describe('constantes', () => {
  it('cobre as 6 categorias da porteira, na mesma ordem dela', () => {
    expect(ORDEM_PRODUTOS).toEqual(['boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho']);
    expect(PRODUTOS.bezerro.unidade).toBe('R$/cabeça');
    expect(PRODUTOS.novilha.unidade).toBe('R$/@');
  });

  it('o Termômetro cobre exatamente o que a porteira publica', () => {
    expect([...ORDEM_PRODUTOS].sort()).toEqual([...PORTEIRA].sort());
  });

  it('municípios na ordem certa', () => {
    expect(MUNICIPIOS_TERMOMETRO).toEqual([
      'Redenção', 'Santana do Araguaia', 'Vila Rica', 'Confresa', 'São Félix do Araguaia',
    ]);
  });
});

describe('cidadesDoProduto', () => {
  const reportes = [
    { produto: 'novilha', municipio: 'Redenção', valor: 300 },
    { produto: 'novilha', municipio: 'Redenção', valor: 310 },
    { produto: 'boi', municipio: 'Confresa', valor: 320 },
  ];

  it('separa por produto e tira a mediana por cidade', () => {
    const novilha = cidadesDoProduto(reportes, 'novilha');
    const redencao = novilha.find((c) => c.municipio === 'Redenção');
    expect(redencao).toMatchObject({ mediana: 305, contagem: 2, uf: 'PA' });
    // O boi de Confresa não pode vazar para a novilha.
    expect(novilha.find((c) => c.municipio === 'Confresa')?.mediana).toBeNull();
  });

  it('cidade sem reporte fica na lista (é convite), com mediana nula', () => {
    const milho = cidadesDoProduto(reportes, 'milho');
    expect(milho).toHaveLength(5);
    expect(milho.every((c) => c.mediana === null && c.contagem === 0)).toBe(true);
  });

  it('quem tem reporte vem primeiro', () => {
    expect(cidadesDoProduto(reportes, 'boi')[0].municipio).toBe('Confresa');
  });
});
