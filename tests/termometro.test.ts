import { describe, it, expect } from 'vitest';
import { validarReporte, resumirReportes, PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO } from '@/lib/termometro';

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

describe('resumirReportes', () => {
  const r = (produto: string, municipio: string, valor: number) => ({ produto, municipio, valor });

  it('agrega média regional e por município, na ordem fixa', () => {
    const resumo = resumirReportes([
      r('soja', 'Vila Rica', 110),
      r('boi', 'Redenção', 320),
      r('boi', 'Redenção', 330),
      r('boi', 'Confresa', 310),
    ]);
    expect(resumo.map((x) => x.produto)).toEqual(['boi', 'soja']); // ordem fixa, sem produtos vazios
    expect(resumo[0]).toMatchObject({ rotulo: 'Boi gordo', unidade: 'R$/@', media: 320, contagem: 3 });
    expect(resumo[0].municipios).toEqual([
      { municipio: 'Redenção', media: 325, contagem: 2 },
      { municipio: 'Confresa', media: 310, contagem: 1 },
    ]);
  });

  it('arredonda médias a 2 casas', () => {
    const resumo = resumirReportes([r('milho', 'Vila Rica', 50), r('milho', 'Vila Rica', 51)]);
    expect(resumo[0].media).toBe(50.5);
  });

  it('lista vazia devolve vazio', () => {
    expect(resumirReportes([])).toEqual([]);
  });
});

describe('constantes', () => {
  it('produtos e municípios na ordem certa', () => {
    expect(ORDEM_PRODUTOS).toEqual(['boi', 'bezerro', 'vaca', 'soja', 'milho']);
    expect(PRODUTOS.bezerro.unidade).toBe('R$/cabeça');
    expect(MUNICIPIOS_TERMOMETRO).toEqual([
      'Redenção', 'Santana do Araguaia', 'Vila Rica', 'Confresa', 'São Félix do Araguaia',
    ]);
  });
});
