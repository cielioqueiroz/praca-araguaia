import { describe, it, expect } from 'vitest';
import { indiceBusca, buscar, agruparResultados, normalizar } from '@/lib/busca';

const indice = indiceBusca();

describe('indiceBusca', () => {
  it('cobre produto, cidade e página', () => {
    const grupos = new Set(indice.map((i) => i.grupo));
    expect(grupos).toEqual(new Set(['Produtos', 'Cidades', 'Páginas']));
  });

  it('todo item tem destino e rótulo', () => {
    for (const i of indice) {
      expect(i.href.startsWith('/')).toBe(true);
      expect(i.rotulo.length).toBeGreaterThan(0);
    }
  });

  it('nasce do que o site já sabe — a porteira inteira está lá', () => {
    // O índice se monta de PORTEIRA/TITULOS/MUNICIPIOS: cotação nova entra na busca
    // sozinha, sem ninguém lembrar de mexer aqui.
    for (const tipo of ['boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho']) {
      expect(indice.some((i) => i.href === `/cotacao/${tipo}`)).toBe(true);
    }
  });
});

describe('buscar', () => {
  it('acha o produto pelo nome', () => {
    expect(buscar(indice, 'boi')[0].href).toBe('/cotacao/boi');
    expect(buscar(indice, 'soja')[0].href).toBe('/cotacao/soja');
  });

  it('o primeiro resultado é o mais relevante — é ele que o Enter escolhe', () => {
    // 'boi' aparece como termo do bezerro e no rótulo 'Boi gordo'; quem começa
    // com o que foi digitado tem de vir antes.
    expect(buscar(indice, 'boi')[0].rotulo).toBe('Boi gordo');
    expect(buscar(indice, 'ouro')[0].rotulo).toBe('Ouro');
  });

  it('ignora acento e caixa', () => {
    expect(buscar(indice, 'REDENÇÃO')[0].rotulo).toBe('Redenção');
    expect(buscar(indice, 'redencao')[0].rotulo).toBe('Redenção');
    expect(buscar(indice, 'GOIÂNIA').length).toBeGreaterThanOrEqual(0);
  });

  it('acha pelos apelidos da praça', () => {
    // Quem digita 'gado' quer o boi; quem digita 'arroba' quer o preço da arroba.
    expect(buscar(indice, 'gado').some((i) => i.href === '/cotacao/boi')).toBe(true);
    expect(buscar(indice, 'nelore').some((i) => i.href === '/cotacao/boi')).toBe(true);
    expect(buscar(indice, 'cripto').some((i) => i.href === '/cotacao/bitcoin')).toBe(true);
    expect(buscar(indice, 'zap').some((i) => i.href === '/boletim')).toBe(true);
  });

  it('acha cidade e página', () => {
    expect(buscar(indice, 'vila rica')[0].grupo).toBe('Cidades');
    expect(buscar(indice, 'calculadora')[0].href).toBe('/calculadora');
  });

  it('consulta vazia não devolve nada — a lista só abre com o que foi digitado', () => {
    expect(buscar(indice, '')).toEqual([]);
    expect(buscar(indice, '   ')).toEqual([]);
  });

  it('sem casamento devolve vazio (a UI mostra "nada encontrado")', () => {
    expect(buscar(indice, 'xyzabc')).toEqual([]);
  });

  it('respeita o limite', () => {
    expect(buscar(indice, 'a', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('agruparResultados', () => {
  it('agrupa mantendo a ordem de relevância', () => {
    const grupos = agruparResultados(buscar(indice, 'boi'));
    expect(grupos[0].grupo).toBe('Produtos');
    expect(grupos.flatMap((g) => g.itens).length).toBe(buscar(indice, 'boi').length);
  });

  it('sem resultado, sem grupo', () => {
    expect(agruparResultados([])).toEqual([]);
  });
});

describe('normalizar', () => {
  it('tira acento, caixa e espaço das pontas', () => {
    expect(normalizar('  Redenção ')).toBe('redencao');
  });
});
