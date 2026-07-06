import { describe, it, expect } from 'vitest';
import {
  linkWhatsApp,
  agruparPorCategoria,
  MENSAGEM_PADRAO,
  normalizarWhatsapp,
  validarFornecedor,
  validarDecisaoFornecedor,
  type Fornecedor,
  type CategoriaFornecedor,
} from '@/lib/fornecedores';

const f = (nome: string, categoria: CategoriaFornecedor, municipio = 'Redenção'): Fornecedor => ({
  nome,
  categoria,
  oQueVende: 'algo',
  municipio,
  whatsapp: '5594999998888',
});

describe('linkWhatsApp', () => {
  it('monta o link wa.me com a mensagem padrão codificada', () => {
    expect(linkWhatsApp('5594999998888')).toBe(
      `https://wa.me/5594999998888?text=${encodeURIComponent(MENSAGEM_PADRAO)}`,
    );
  });

  it('aceita mensagem custom, também codificada', () => {
    expect(linkWhatsApp('5594999998888', 'Oi, tudo bem?')).toBe(
      'https://wa.me/5594999998888?text=Oi%2C%20tudo%20bem%3F',
    );
  });
});

describe('agruparPorCategoria', () => {
  const lista = [
    f('Casa A', 'veterinario'),
    f('Casa B', 'racao-sal'),
    f('Casa C', 'racao-sal'),
  ];

  it('agrupa na ordem de CATEGORIAS e omite categorias vazias', () => {
    const grupos = agruparPorCategoria(lista);
    expect(grupos.map((g) => g.categoria)).toEqual(['racao-sal', 'veterinario']); // ordem fixa; sem as vazias
    expect(grupos[0].fornecedores.map((x) => x.nome)).toEqual(['Casa B', 'Casa C']);
    expect(grupos[0].rotulo).toBe('Ração e sal');
  });

  it('filtro por categoria devolve só aquela', () => {
    const grupos = agruparPorCategoria(lista, 'racao-sal');
    expect(grupos).toHaveLength(1);
    expect(grupos[0].categoria).toBe('racao-sal');
  });

  it('filtro numa categoria sem fornecedor devolve vazio', () => {
    expect(agruparPorCategoria(lista, 'maquinas-pecas')).toEqual([]);
  });

  it('lista vazia devolve vazio', () => {
    expect(agruparPorCategoria([])).toEqual([]);
  });
});

describe('normalizarWhatsapp', () => {
  it('prepende 55 quando vem só DDD+número', () => {
    expect(normalizarWhatsapp('(94) 99999-8888')).toBe('5594999998888');
    expect(normalizarWhatsapp('9499998888')).toBe('559499998888'); // 10 dígitos → +55
  });
  it('mantém quando já tem DDI e tira lixo não-numérico', () => {
    expect(normalizarWhatsapp('55 94 99999-8888')).toBe('5594999998888');
    expect(normalizarWhatsapp('abc')).toBe('');
  });
});

describe('validarFornecedor', () => {
  const valido = {
    nome: 'Casa Agro',
    categoria: 'racao-sal',
    oQueVende: 'ração e sal mineral',
    municipio: 'Redenção',
    whatsapp: '(94) 99999-8888',
    contato: '',
  };

  it('aceita e normaliza (whatsapp com 55, strings trimadas)', () => {
    const r = validarFornecedor(valido);
    expect(r).toEqual({
      tipo: 'valido',
      fornecedor: {
        nome: 'Casa Agro',
        categoria: 'racao-sal',
        oQueVende: 'ração e sal mineral',
        municipio: 'Redenção',
        whatsapp: '5594999998888',
      },
    });
  });

  it('honeypot preenchido → honeypot', () => {
    expect(validarFornecedor({ ...valido, contato: 'sou bot' })).toEqual({ tipo: 'honeypot' });
  });

  it('rejeita nome curto, categoria fora da lista, oQueVende vazio, município curto e whatsapp inválido', () => {
    expect(validarFornecedor({ ...valido, nome: 'A' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, categoria: 'inexistente' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, oQueVende: ' ' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, municipio: 'X' }).tipo).toBe('invalido');
    expect(validarFornecedor({ ...valido, whatsapp: '123' }).tipo).toBe('invalido');
  });

  it('corpo não-objeto → inválido', () => {
    expect(validarFornecedor(null).tipo).toBe('invalido');
  });
});

describe('validarDecisaoFornecedor', () => {
  const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  it('aceita aprovado/rejeitado/removido com UUID', () => {
    for (const decisao of ['aprovado', 'rejeitado', 'removido'] as const) {
      expect(validarDecisaoFornecedor({ id: UUID, decisao })).toEqual({ tipo: 'valido', id: UUID, decisao });
    }
  });
  it('rejeita id não-UUID e decisão desconhecida', () => {
    expect(validarDecisaoFornecedor({ id: 'abc', decisao: 'aprovado' }).tipo).toBe('invalido');
    expect(validarDecisaoFornecedor({ id: UUID, decisao: 'sumir' }).tipo).toBe('invalido');
  });
});
