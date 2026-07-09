'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { filtrarPorPeriodo } from '@/lib/grafico';
import type { PontoHistorico } from '@/types/cotacao';

const PERIODOS = [7, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number];

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function GraficoCotacao({
  pontos,
  titulo,
  unidade,
}: {
  pontos: PontoHistorico[];
  titulo: string;
  unidade: string;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const config = useMemo(
    () => ({ valor: { label: `${titulo} (${unidade})`, color: '#15803d' } }) satisfies ChartConfig,
    [titulo, unidade],
  );

  const dados = useMemo(
    () =>
      filtrarPorPeriodo(pontos, periodo).map((p) => ({
        rotulo: fmtData.format(new Date(p.data)),
        valor: p.valor,
      })),
    [pontos, periodo],
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
            {/* Com 1 ponto não há linha — o dot é o único traço visível (dado semanal no período de 7d). */}
            <Line dataKey="valor" type="monotone" stroke="var(--color-valor)" strokeWidth={2} dot={dados.length < 2} />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
