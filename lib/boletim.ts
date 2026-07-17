import {
  TITULOS,
  ORDEM_PAINEL,
  PORTEIRA,
  UNIDADE_PORTEIRA,
  FONTE_PORTEIRA,
  NAO_E_MOEDA,
} from '@/lib/tipos-ui';
import { NOME_UF, ordenarPorPraca, ordenarPorUf } from '@/lib/praca';
import type { PrecoPraca, PrecoUf } from '@/types/cotacao';

// Linha crua vinda de `cotacoes` (tipos já convertidos pelo chamador).
export type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null };

export type Variacao = { texto: string; direcao: 'alta' | 'baixa' };

export type LinhaUfBoletim = { nome: string; valorFmt: string; variacao?: Variacao };

/** Uma commodity: o preço de cada estado, nunca uma média. */
export type ItemPorteira = {
  tipo: string;
  titulo: string;
  unidade: string; // 'R$ por arroba'
  rodape: string; // 'CONAB · semana de 29/06 a 03/07' ou 'Datagro · 10/07'
  ufs: LinhaUfBoletim[];
  /** O que os produtores reportaram nas cidades — só as que TÊM reporte.
   *  No card, repetir as 5 cidades vazias em 6 produtos viraria 30 linhas de nada;
   *  o convite a reportar vive no site, que tem espaço para ele. */
  cidades: CidadeBoletim[];
};

export type ItemMercado = {
  tipo: string;
  titulo: string;
  valorFmt: string; // 'R$ 678,23 /g'
  variacao?: Variacao;
};

/** Uma cidade da praça: o que os produtores reportaram no Termômetro. */
export type CidadeBoletim = { municipio: string; uf: string; valorFmt: string | null; contagem: number };

export type Boletim = {
  dataExtenso: string;
  porteira: ItemPorteira[];
  mercado: ItemMercado[];
  /** Nenhum produto teve reporte na semana: o card faz o convite em uma linha. */
  semReportes: boolean;
};

export type ReporteCidade = {
  produto: string;
  municipio: string;
  uf: string;
  mediana: number | null;
  contagem: number;
};

// Sufixo compacto depois do número, para o valor não ficar poluído.
const SUFIXO: Record<string, string> = { ouro: '/g', ouro18k: '/g' };
const CASAS: Record<string, number> = { dolar: 4, euro: 4, ibovespa: 0 };

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

// A CONAB fecha a semana (segunda a sexta) — mostra o intervalo. Datagro e Scot
// publicam por dia — mostram o dia. O nome da fonte vem junto: o produtor precisa
// saber quem apurou aquele preço.
export function rodapeDaFonte(tipo: string, iso: string): string {
  const fonte = FONTE_PORTEIRA[tipo];
  const fim = new Date(iso);
  if (!fonte) return fmtDia.format(fim);
  if (!fonte.semanal) return `${fonte.nome} · ${fmtDia.format(fim)}`;

  const inicio = new Date(fim.getTime() - 4 * 24 * 60 * 60 * 1000);
  return `${fonte.nome} · semana de ${fmtDia.format(inicio)} a ${fmtDia.format(fim)}`;
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
  precosPraca: PrecoPraca[] = [],
): Boletim {
  // Porteira: só entra a commodity que tem preço por lugar — sem lugar, sem linha
  // (a média antiga não volta disfarçada).
  const porteira: ItemPorteira[] = PORTEIRA.flatMap((tipo) => {
    // Boi e vaca vêm por PRAÇA (Scot); o resto, por estado. Quando há praça, ela
    // manda: o card tem de dizer "Redenção", não "Pará" — foi para isso que a
    // fatia 17 trocou a fonte. Ordem fixa: o banco não garante nenhuma.
    const pracas = ordenarPorPraca(precosPraca.filter((p) => p.tipo === tipo));
    const ufs = ordenarPorUf(precosUf.filter((p) => p.tipo === tipo));

    const lugares: Array<{ nome: string; valor: number; variacaoPct: number | null; dataReferencia: string }> =
      pracas.length > 0
        ? // Duas praças podem ter o mesmo nome em estados diferentes (Norte no MT e
          // Norte no TO): sem a sigla, o card mostraria duas linhas "Norte".
          pracas.map((p) => ({ nome: `${p.praca} · ${p.uf}`, valor: p.valor, variacaoPct: p.variacaoPct, dataReferencia: p.dataReferencia }))
        : ufs.map((p) => ({ nome: NOME_UF[p.uf] ?? p.uf, valor: p.valor, variacaoPct: p.variacaoPct, dataReferencia: p.dataReferencia }));

    if (lugares.length === 0) return [];
    const maisRecente = lugares.reduce((a, b) => (a.dataReferencia >= b.dataReferencia ? a : b));
    return [
      {
        tipo,
        titulo: TITULOS[tipo] ?? tipo,
        unidade: UNIDADE_PORTEIRA[tipo] ?? '',
        rodape: rodapeDaFonte(tipo, maisRecente.dataReferencia),
        ufs: lugares.map((p) => ({
          nome: p.nome,
          valorFmt: numero(p.valor, 2),
          variacao: variacaoDe(p.variacaoPct),
        })),
        cidades: reportes
          .filter((r) => r.produto === tipo && r.mediana !== null)
          .map((r) => ({
            municipio: r.municipio,
            uf: r.uf,
            valorFmt: numero(r.mediana as number, 2),
            contagem: r.contagem,
          })),
      },
    ];
  });

  const mercado: ItemMercado[] = linhas
    .filter((l) => !PORTEIRA.includes(l.tipo))
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const n = numero(l.valor, CASAS[l.tipo] ?? 2);
      // O Ibovespa é ponto: escrever "R$ 176.617" seria mentira.
      const valorFmt = NAO_E_MOEDA.has(l.tipo)
        ? `${n} pts`
        : `R$ ${n}${SUFIXO[l.tipo] ? ` ${SUFIXO[l.tipo]}` : ''}`;
      return {
        tipo: l.tipo,
        titulo: TITULOS[l.tipo] ?? l.tipo,
        valorFmt,
        variacao: variacaoDe(l.variacao_pct),
      };
    });

  const semReportes = reportes.every((r) => r.mediana === null);

  return { dataExtenso: fmtDataExtenso.format(agora), porteira, mercado, semReportes };
}
