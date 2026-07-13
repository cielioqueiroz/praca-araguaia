import { ORDEM_PAINEL } from '@/lib/tipos-ui';

export type TickerItem = { rotulo: string; valor: string; dir: 'up' | 'down'; pct: string };

export type LinhaTicker = { tipo: string; valor: number; variacao_pct: number | null };

// Rótulo curto (a faixa é estreita) e casas por tipo.
const ROTULO: Record<string, string> = {
  boi: 'BOI @',
  soja: 'SOJA',
  milho: 'MILHO',
  dolar: 'USD',
  euro: 'EUR',
  ouro: 'OURO/g',
  bitcoin: 'BTC',
  ethereum: 'ETH',
};
const CASAS: Record<string, number> = { dolar: 4, euro: 4 };

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

// Cripto passa de mil reais: sem centavos a faixa fica ilegível.
function formatar(tipo: string, valor: number): string {
  const casas = CASAS[tipo] ?? (valor >= 10000 ? 0 : 2);
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

export function montarTicker(linhas: LinhaTicker[]): TickerItem[] {
  return linhas
    .filter((l) => l.tipo in ROTULO)
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo))
    .map((l) => {
      const pct = l.variacao_pct ?? 0;
      return {
        rotulo: ROTULO[l.tipo],
        valor: formatar(l.tipo, l.valor),
        dir: pct >= 0 ? ('up' as const) : ('down' as const),
        pct: Math.abs(pct).toLocaleString('pt-BR'),
      };
    });
}
