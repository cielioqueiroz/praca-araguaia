'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { filtrarPorPeriodo } from '@/lib/grafico';
import { marcaDeTroca } from '@/lib/trocas-de-fonte';
import type { PontoHistorico } from '@/types/cotacao';

const PERIODOS = [7, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number];

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function GraficoCotacao({
  pontos,
  titulo,
  unidade,
  tipoCotacao,
}: {
  pontos: PontoHistorico[];
  titulo: string;
  unidade: string;
  /**
   * Só o gráfico de PREÇO DE REFERÊNCIA manda o tipo — é ele que pode ter trocado de
   * apurador no meio da série. O Termômetro reusa este mesmo componente e não manda:
   * reporte de produtor não muda de fonte, e uma marca ali seria mentira.
   */
  tipoCotacao?: string;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const config = useMemo(
    () => ({ valor: { label: `${titulo} (${unidade})`, color: '#15803d' } }) satisfies ChartConfig,
    [titulo, unidade],
  );

  const doPeriodo = useMemo(() => filtrarPorPeriodo(pontos, periodo), [pontos, periodo]);

  const dados = useMemo(
    () =>
      doPeriodo.map((p) => ({
        rotulo: fmtData.format(new Date(p.data)),
        valor: p.valor,
      })),
    [doPeriodo],
  );

  // A emenda de fonte dentro desta janela — ~1% de degrau que, sem marca, se lê como
  // movimento de mercado (ADR 0002). Some sozinha quando a janela é só da fonte nova.
  const marca = useMemo(
    () => (tipoCotacao ? marcaDeTroca(tipoCotacao, doPeriodo) : null),
    [tipoCotacao, doPeriodo],
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodo(p)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto ${
              periodo === p
                ? 'bg-mata text-white'
                : 'border border-linha bg-papel text-tinta/60 hover:bg-linha/60'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {dados.length === 0 ? (
        <p className="text-sm text-tinta/50">Sem dados neste período.</p>
      ) : (
        <ChartContainer config={config} className="h-[280px] w-full">
          <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {marca && (
              <ReferenceLine
                x={dados[marca.indice].rotulo}
                stroke="#8a8577"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: 'troca de fonte', position: 'insideTopLeft', fill: '#8a8577', fontSize: 10 }}
              />
            )}
            {/* Com 1 ponto não há linha — o dot é o único traço visível (dado semanal no período de 7d). */}
            <Line dataKey="valor" type="monotone" stroke="var(--color-valor)" strokeWidth={2} dot={dados.length < 2} />
          </LineChart>
        </ChartContainer>
      )}

      {marca && (
        <p className="mt-2 flex items-center gap-2 text-xs text-tinta/50">
          <span aria-hidden="true" className="inline-block h-px w-6 border-t border-dashed border-tinta/40" />
          {marca.nota} — mesma unidade, apurador diferente. O degrau na data é troca de fonte, não do mercado.
        </p>
      )}
    </div>
  );
}
