import { describe, it, expect } from 'vitest';
import { faixasDaPorteira } from '@/lib/faixa-porteira';

describe('faixasDaPorteira', () => {
  const precos = [
    { tipo: 'boi', valor: 338 },
    { tipo: 'boi', valor: 345.5 },
    { tipo: 'boi', valor: 321 },
    { tipo: 'milho', valor: 66.6 },
    { tipo: 'milho', valor: 40.2 },
    { tipo: 'dolar', valor: 5.2 }, // não é porteira: fica de fora
  ];

  it('devolve o menor e o maior de cada produto, com quantos lugares', () => {
    const faixas = faixasDaPorteira(precos);
    expect(faixas.find((f) => f.tipo === 'boi')).toMatchObject({
      rotulo: 'Boi gordo', unidade: 'R$ por arroba', min: 321, max: 345.5, lugares: 3,
    });
    // O caso que matou a média na fatia 15: 66,60 no Pará contra 40,20 em Mato Grosso.
    expect(faixas.find((f) => f.tipo === 'milho')).toMatchObject({ min: 40.2, max: 66.6, lugares: 2 });
  });

  it('só entra o que é da porteira — mercado não', () => {
    expect(faixasDaPorteira(precos).map((f) => f.tipo)).toEqual(['boi', 'milho']);
  });

  it('mantém a ordem da porteira (gado antes da lavoura), não a ordem do banco', () => {
    const fora = [{ tipo: 'soja', valor: 120 }, { tipo: 'vaca', valor: 300 }, { tipo: 'boi', valor: 330 }];
    expect(faixasDaPorteira(fora).map((f) => f.tipo)).toEqual(['boi', 'vaca', 'soja']);
  });

  it('um lugar só: min e max iguais, sem fingir faixa', () => {
    expect(faixasDaPorteira([{ tipo: 'boi', valor: 338 }])[0]).toMatchObject({ min: 338, max: 338, lugares: 1 });
  });

  it('produto sem preço não vira linha vazia', () => {
    expect(faixasDaPorteira([])).toEqual([]);
  });

  it('ignora valor não numérico em vez de propagar NaN para a tela', () => {
    const comLixo = [{ tipo: 'boi', valor: Number('abc') }, { tipo: 'boi', valor: 330 }];
    expect(faixasDaPorteira(comLixo)[0]).toMatchObject({ min: 330, max: 330, lugares: 1 });
  });
});

describe('unidade no cartão compacto', () => {
  it('a faixa carrega a unidade curta, sem a especificação do animal', () => {
    // "R$ por cabeça · fêmea nelore, 18 meses" quebrava em duas linhas no cartão
    // estreito da home e desalinhava o rodapé de toda a faixa.
    const faixas = faixasDaPorteira([
      { tipo: 'novilha', valor: 3000 },
      { tipo: 'bezerro', valor: 3400 },
      { tipo: 'boi', valor: 330 },
      { tipo: 'soja', valor: 120 },
    ]);
    const curta = Object.fromEntries(faixas.map((f) => [f.tipo, f.unidadeCurta]));
    expect(curta.novilha).toBe('R$ por cabeça');
    expect(curta.bezerro).toBe('R$ por cabeça');
    // Onde não havia especificação, nada muda.
    expect(curta.boi).toBe('R$ por arroba');
    expect(curta.soja).toBe('R$ por saca de 60 kg');
  });

  it('a unidade completa continua disponível para o cartão grande', () => {
    const [novilha] = faixasDaPorteira([{ tipo: 'novilha', valor: 3000 }]);
    expect(novilha.unidade).toBe('R$ por cabeça · fêmea nelore, 18 meses');
  });
});
