import { ORDEM_PAINEL, prazoDesatualizadoMs } from '@/lib/tipos-ui';
import { numero } from '@/lib/formato';

export type TickerItem = { rotulo: string; valor: string; dir: 'up' | 'down' | 'estavel' | 'sem_dado'; pct: string };

export type LinhaTicker = { tipo: string; valor: number; variacao_pct: number | null; local?: string; data_referencia?: string };

// Rótulo curto (a faixa é estreita) e casas por tipo.
const ROTULO: Record<string, string> = {
  boi: 'BOI @',
  soja: 'SOJA/sc',
  milho: 'MILHO/sc',
  dolar: 'USD',
};
const CASAS: Record<string, number> = { dolar: 4, euro: 4 };

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

// Cripto passa de mil reais: sem centavos a faixa fica ilegível.
function formatar(tipo: string, valor: number): string {
  const casas = CASAS[tipo] ?? (valor >= 10000 ? 0 : 2);
  return numero(valor, casas);
}

export function montarTicker(linhas: LinhaTicker[], agora: Date = new Date()): TickerItem[] {
  return linhas
    .filter((l) => l.tipo in ROTULO)
    .filter((l) => !l.data_referencia || agora.getTime() - new Date(l.data_referencia).getTime() <= prazoDesatualizadoMs(l.tipo))
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const pct = l.variacao_pct;
      return {
        rotulo: l.local ? `${ROTULO[l.tipo]} ${l.local}` : ROTULO[l.tipo],
        valor: formatar(l.tipo, l.valor),
        dir: pct === null ? 'sem_dado' as const : pct === 0 ? 'estavel' as const : pct > 0 ? 'up' as const : 'down' as const,
        pct: pct === null ? '—' : pct === 0 ? 'estável' : `${Math.abs(pct).toLocaleString('pt-BR')}%`,
      };
    });
}
