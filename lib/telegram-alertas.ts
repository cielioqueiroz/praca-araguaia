import { TITULOS, ORDEM_PAINEL } from '@/lib/tipos-ui';

export const LIMITE_ALERTA_PCT = 3;

export type LinhaCotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  variacao_pct: number | null;
  data_referencia: string;
};

export type Mover = {
  tipo: string;
  variacaoPct: number;
  valor: number;
  unidade: string;
  dataReferencia: string;
};

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

// Filtra as cotações que cruzaram o limite (±), na ordem do painel.
export function detectarMovers(linhas: LinhaCotacao[], limite: number = LIMITE_ALERTA_PCT): Mover[] {
  return linhas
    .filter((l) => l.variacao_pct !== null && Math.abs(l.variacao_pct) >= limite)
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => ({
      tipo: l.tipo,
      variacaoPct: l.variacao_pct as number,
      valor: l.valor,
      unidade: l.unidade,
      dataReferencia: l.data_referencia,
    }));
}

const fmtValor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Araguaina' });

export function montarMensagemAlerta(movers: Mover[], agora: Date): string {
  const linhas = movers.map((m) => {
    const seta = m.variacaoPct >= 0 ? '▲' : '▼';
    return `${seta} ${TITULOS[m.tipo] ?? m.tipo} ${fmtPct.format(m.variacaoPct)}%  ${m.unidade} ${fmtValor.format(m.valor)}`;
  });
  return (
    `🚨 Praça Araguaia — movimento forte hoje (${fmtDia.format(agora)})\n` +
    linhas.join('\n') +
    `\nPainel completo: agroapp-bay.vercel.app`
  );
}
