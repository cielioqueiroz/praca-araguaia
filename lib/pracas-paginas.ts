import { MUNICIPIOS } from '@/lib/fontes/chuva';
import { PRACAS_DA_REGIAO } from '@/lib/fontes/scot';
import { NOME_UF } from '@/lib/praca';

/**
 * Uma página por cidade — o que o produtor de fato procura.
 *
 * "Preço do boi hoje em Redenção" é o que se digita no Google e o que se manda no
 * grupo; até aqui o site só tinha `/cotacoes`, uma página só para as sete praças, sem
 * endereço próprio para nenhuma delas. Sem URL por cidade não há como ser achado nem
 * compartilhado com precisão — e descoberta é a única alavanca de audiência que
 * funciona sem o dono ligar para alguém.
 *
 * A lista NÃO é digitada à mão duas vezes: sai da união do que as fontes já cobrem —
 * as praças de cidade da Scot (preço do gado pesquisado ali) e os municípios da chuva,
 * que são os mesmos do Termômetro. Cidade sem nada não vira página.
 */
export type PaginaPraca = {
  slug: string;
  nome: string;
  uf: string;
  /** A Scot pesquisa o gado NESTA cidade (só as três do Pará). */
  temScot: boolean;
  /** Tem previsão própria e recebe reporte do Termômetro (são a mesma lista). */
  temChuva: boolean;
};

/** 'São Félix do Araguaia' → 'sao-felix-do-araguaia'. */
export function slugDaCidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// As praças da Scot que são CIDADE de verdade. Fora do Pará a Scot publica região
// ("MT Norte", "BA Oeste") e o site rotula com o nome do estado — "Mato Grosso" não é
// uma cidade e não pode virar página de cidade.
const CIDADES_SCOT = Object.values(PRACAS_DA_REGIAO)
  .filter(({ uf, praca }) => praca !== (NOME_UF[uf] ?? ''))
  .map(({ uf, praca }) => ({ uf, nome: praca }));

const CIDADES_CHUVA = MUNICIPIOS.map((m) => ({ uf: m.uf as string, nome: m.nome as string }));

function juntar(): PaginaPraca[] {
  const porChave = new Map<string, PaginaPraca>();
  const chave = (c: { nome: string; uf: string }) => `${c.uf}|${c.nome}`;

  for (const c of CIDADES_SCOT) {
    porChave.set(chave(c), { slug: slugDaCidade(c.nome), nome: c.nome, uf: c.uf, temScot: true, temChuva: false });
  }
  for (const c of CIDADES_CHUVA) {
    const existente = porChave.get(chave(c));
    if (existente) existente.temChuva = true;
    else porChave.set(chave(c), { slug: slugDaCidade(c.nome), nome: c.nome, uf: c.uf, temScot: false, temChuva: true });
  }
  // Ordem estável: Pará (onde a Scot pesquisa) primeiro, depois o resto, alfabético.
  return [...porChave.values()].sort(
    (a, b) => Number(b.temScot) - Number(a.temScot) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

export const PAGINAS_PRACA: PaginaPraca[] = juntar();

export function paginaPorSlug(slug: string): PaginaPraca | undefined {
  return PAGINAS_PRACA.find((p) => p.slug === slug);
}

/** 'Redenção (PA)' — como a cidade se escreve por extenso na tela e no título. */
export function cidadeComUf(p: PaginaPraca): string {
  return `${p.nome} (${p.uf})`;
}
