import { TITULOS, ORDEM_PAINEL, LEGENDAS } from '@/lib/tipos-ui';

// Linha crua vinda de `cotacoes` (tipos já convertidos pelo chamador).
export type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null };

export type ItemBoletim = {
  titulo: string;
  valorFmt: string; // ex.: "R$/@ 326,96"
  variacao?: { texto: string; direcao: 'alta' | 'baixa' };
  legenda?: string;
};

export type Boletim = { dataExtenso: string; itens: ItemBoletim[] };

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
// Araguaia fica no fuso -03:00 sem horário de verão; fixar o fuso torna a data
// determinística no serverless (relógio UTC) e nos testes.
const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

export function montarBoletim(linhas: LinhaCotacao[], agora: Date = new Date()): Boletim {
  const itens = linhas
    .slice()
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const item: ItemBoletim = {
        titulo: TITULOS[l.tipo] ?? l.tipo,
        valorFmt: `${l.unidade} ${fmtValor.format(l.valor)}`,
      };
      if (l.variacao_pct !== null) {
        item.variacao = {
          texto: `${Math.abs(l.variacao_pct).toLocaleString('pt-BR')}%`,
          direcao: l.variacao_pct >= 0 ? 'alta' : 'baixa',
        };
      }
      const legenda = LEGENDAS[l.tipo];
      if (legenda) item.legenda = legenda;
      return item;
    });
  return { dataExtenso: fmtDataExtenso.format(agora), itens };
}
