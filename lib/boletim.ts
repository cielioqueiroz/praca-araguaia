import { TITULOS, ORDEM_PAINEL, LEGENDAS } from '@/lib/tipos-ui';

// Linha crua vinda de `cotacoes` (tipos já convertidos pelo chamador).
export type LinhaCotacao = { tipo: string; valor: number; unidade: string; variacao_pct: number | null };

export type ItemBoletim = {
  titulo: string;
  valorFmt: string; // ex.: "326,96 @", "113,70 SC 60kg", "R$ 5,1945"
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

// Unidade compacta depois do número, para o valor não ficar poluído.
// Ex.: boi "321,26 @", soja "113,70 SC 60kg", ouro "R$ 21.222,30 /g".
const SUFIXO: Record<string, string> = { boi: '@', soja: 'SC 60kg', milho: 'SC 60kg', ouro: '/g' };
const COM_RS = new Set(['dolar', 'euro', 'ouro']);

function formatarValor(tipo: string, valor: number): string {
  const prefixo = COM_RS.has(tipo) ? 'R$ ' : '';
  const sufixo = SUFIXO[tipo] ? ` ${SUFIXO[tipo]}` : '';
  return `${prefixo}${fmtValor.format(valor)}${sufixo}`;
}

export function montarBoletim(linhas: LinhaCotacao[], agora: Date = new Date()): Boletim {
  const itens = linhas
    .slice()
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const item: ItemBoletim = {
        titulo: TITULOS[l.tipo] ?? l.tipo,
        valorFmt: formatarValor(l.tipo, l.valor),
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
