import { describe, it, expect } from 'vitest';
import {
  linkWhatsApp,
  agruparPorCategoria,
  CATEGORIAS,
  FORNECEDORES,
  MENSAGEM_PADRAO,
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

describe('invariante dos FORNECEDORES curados', () => {
  const ids = new Set(CATEGORIAS.map((c) => c.id));
  it('toda categoria é válida e o whatsapp é só dígitos (DDI+DDD+número)', () => {
    for (const forn of FORNECEDORES) {
      expect(ids.has(forn.categoria)).toBe(true);
      expect(forn.whatsapp).toMatch(/^\d{12,13}$/);
      expect(forn.nome.trim()).not.toBe('');
    }
  });
});
