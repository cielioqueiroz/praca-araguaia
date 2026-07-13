import { TITULOS, ORDEM_PAINEL } from '@/lib/tipos-ui';
import { NOME_UF } from '@/lib/praca';
import type { PrecoUf } from '@/types/cotacao';

// Linha crua vinda de `cotacoes` (tipos já convertidos pelo chamador).
export type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null };

export type Variacao = { texto: string; direcao: 'alta' | 'baixa' };

export type LinhaUfBoletim = { nome: string; valorFmt: string; variacao?: Variacao };

/** Uma commodity: o preço de cada estado, nunca uma média. */
export type ItemPorteira = {
  tipo: string;
  titulo: string;
  unidade: string; // 'R$ por arroba'
  semana: string; // 'semana de 29/06 a 03/07'
  ufs: LinhaUfBoletim[];
};

export type ItemMercado = {
  tipo: string;
  titulo: string;
  valorFmt: string; // 'R$ 678,23 /g'
  variacao?: Variacao;
};

/** Boi nas cidades da praça: o que os produtores reportaram no Termômetro. */
export type CidadeBoletim = { municipio: string; uf: string; valorFmt: string | null; contagem: number };

export type Boletim = {
  dataExtenso: string;
  porteira: ItemPorteira[];
  mercado: ItemMercado[];
  cidades: CidadeBoletim[];
};

export type ReporteCidade = { municipio: string; uf: string; mediana: number | null; contagem: number };

const PORTEIRA = ['boi', 'soja', 'milho'];

const UNIDADE_PORTEIRA: Record<string, string> = {
  boi: 'R$ por arroba',
  soja: 'R$ por saca de 60 kg',
  milho: 'R$ por saca de 60 kg',
};

// Sufixo compacto depois do número, para o valor não ficar poluído.
const SUFIXO: Record<string, string> = { ouro: '/g' };
const CASAS: Record<string, number> = { dolar: 4, euro: 4 };

// Araguaia fica no fuso -03:00 sem horário de verão; fixar o fuso torna a data
// determinística no serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Araguaina' });

function numero(valor: number, casas: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

function variacaoDe(pct: number | null): Variacao | undefined {
  if (pct === null) return undefined;
  return {
    texto: `${Math.abs(pct).toLocaleString('pt-BR')}%`,
    direcao: pct >= 0 ? 'alta' : 'baixa',
  };
}

// A CONAB publica a semana fechada (segunda a sexta): o rótulo mostra o intervalo.
function rotuloSemana(iso: string): string {
  const fim = new Date(iso);
  const inicio = new Date(fim.getTime() - 4 * 24 * 60 * 60 * 1000);
  return `semana de ${fmtDia.format(inicio)} a ${fmtDia.format(fim)}`;
}

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

export function montarBoletim(
  linhas: LinhaCotacao[],
  precosUf: PrecoUf[],
  reportes: ReporteCidade[] = [],
  agora: Date = new Date(),
): Boletim {
  // Porteira: só entra a commodity que tem preço por estado — sem estado, sem linha
  // (a média antiga não volta disfarçada).
  const porteira: ItemPorteira[] = PORTEIRA.flatMap((tipo) => {
    const ufs = precosUf.filter((p) => p.tipo === tipo);
    if (ufs.length === 0) return [];
    const maisRecente = ufs.reduce((a, b) => (a.dataReferencia >= b.dataReferencia ? a : b));
    return [
      {
        tipo,
        titulo: TITULOS[tipo] ?? tipo,
        unidade: UNIDADE_PORTEIRA[tipo] ?? '',
        semana: rotuloSemana(maisRecente.dataReferencia),
        ufs: ufs.map((p) => ({
          nome: NOME_UF[p.uf] ?? p.uf,
          valorFmt: numero(p.valor, 2),
          variacao: variacaoDe(p.variacaoPct),
        })),
      },
    ];
  });

  const mercado: ItemMercado[] = linhas
    .filter((l) => !PORTEIRA.includes(l.tipo))
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => ({
      tipo: l.tipo,
      titulo: TITULOS[l.tipo] ?? l.tipo,
      valorFmt: `R$ ${numero(l.valor, CASAS[l.tipo] ?? 2)}${SUFIXO[l.tipo] ? ` ${SUFIXO[l.tipo]}` : ''}`,
      variacao: variacaoDe(l.variacao_pct),
    }));

  const cidades: CidadeBoletim[] = reportes.map((r) => ({
    municipio: r.municipio,
    uf: r.uf,
    valorFmt: r.mediana === null ? null : numero(r.mediana, 2),
    contagem: r.contagem,
  }));

  return { dataExtenso: fmtDataExtenso.format(agora), porteira, mercado, cidades };
}
