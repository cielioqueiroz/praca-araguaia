import { mediana } from '@/lib/termometro';
import type { PontoHistorico } from '@/types/cotacao';

export type ReporteHistorico = { valor: number; criado_em: string };

// en-CA formata como YYYY-MM-DD; timeZone converte o instante para o dia local da praça.
const diaAraguaia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Araguaina',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Agrupa reportes de UM produto (já aprovados) por dia local e devolve a mediana de cada
// dia, ordenado por data crescente.
export function historicoTermometro(reportes: ReporteHistorico[]): PontoHistorico[] {
  const porDia = new Map<string, number[]>();
  for (const { criado_em, valor } of reportes) {
    const dia = diaAraguaia.format(new Date(criado_em));
    const lista = porDia.get(dia);
    if (lista) lista.push(valor);
    else porDia.set(dia, [valor]);
  }
  return [...porDia.entries()]
    .map(([data, valores]) => ({ data, valor: mediana(valores) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
