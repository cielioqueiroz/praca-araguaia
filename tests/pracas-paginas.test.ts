import { describe, it, expect } from 'vitest';
import { PAGINAS_PRACA, paginaPorSlug, slugDaCidade, cidadeComUf } from '@/lib/pracas-paginas';
import { MUNICIPIOS } from '@/lib/fontes/chuva';

describe('slugDaCidade', () => {
  it('tira acento, caixa e espaço', () => {
    expect(slugDaCidade('Redenção')).toBe('redencao');
    expect(slugDaCidade('São Félix do Araguaia')).toBe('sao-felix-do-araguaia');
    expect(slugDaCidade('Santana do Araguaia')).toBe('santana-do-araguaia');
    expect(slugDaCidade('Marabá')).toBe('maraba');
  });
});

describe('PAGINAS_PRACA', () => {
  it('cobre as três praças de cidade da Scot e os cinco municípios da chuva', () => {
    const nomes = PAGINAS_PRACA.map((p) => p.nome);
    for (const cidade of ['Marabá', 'Paragominas', 'Redenção']) expect(nomes).toContain(cidade);
    for (const m of MUNICIPIOS) expect(nomes).toContain(m.nome);
  });

  it('não cria página para praça que na verdade é um estado', () => {
    // Fora do Pará a Scot publica região ("MT Norte") e o site rotula com o nome do
    // estado. "Mato Grosso" não é cidade e não pode virar página de cidade.
    const nomes = PAGINAS_PRACA.map((p) => p.nome);
    expect(nomes).not.toContain('Mato Grosso');
    expect(nomes).not.toContain('Tocantins');
    expect(nomes).not.toContain('Bahia');
  });

  it('Redenção acumula as duas coberturas (é praça da Scot e município da chuva)', () => {
    const redencao = paginaPorSlug('redencao');
    expect(redencao).toMatchObject({ nome: 'Redenção', uf: 'PA', temScot: true, temChuva: true });
  });

  it('Marabá tem gado da Scot, mas não tem chuva nem Termômetro', () => {
    expect(paginaPorSlug('maraba')).toMatchObject({ temScot: true, temChuva: false });
  });

  it('Confresa tem chuva e Termômetro, mas a Scot não pesquisa lá', () => {
    expect(paginaPorSlug('confresa')).toMatchObject({ uf: 'MT', temScot: false, temChuva: true });
  });

  it('slug desconhecido não devolve página (a rota dá 404)', () => {
    expect(paginaPorSlug('goiania')).toBeUndefined();
    expect(paginaPorSlug('')).toBeUndefined();
  });

  it('cada slug é único — duas cidades não podem disputar a mesma URL', () => {
    const slugs = PAGINAS_PRACA.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('escreve a cidade com a UF entre parênteses', () => {
    expect(cidadeComUf({ slug: 'redencao', nome: 'Redenção', uf: 'PA', temScot: true, temChuva: true })).toBe(
      'Redenção (PA)',
    );
  });
});
