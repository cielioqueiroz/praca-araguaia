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

const config = {
  valor: { label: 'Dólar (R$)', color: 'hsl(142 71% 45%)' },
} satisfies ChartConfig;

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function GraficoCotacao({ pontos }: { pontos: PontoHistorico[] }) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

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
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              periodo === p
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {dados.length === 0 ? (
        <p className="text-sm text-neutral-500">Sem dados neste período.</p>
      ) : (
        <ChartContainer config={config} className="h-[280px] w-full">
          <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="valor" type="monotone" stroke="var(--color-valor)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
