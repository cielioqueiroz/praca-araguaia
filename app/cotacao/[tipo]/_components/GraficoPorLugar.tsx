'use client';

import { useState } from 'react';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { dataLonga } from '@/lib/formato';
import { lugarInicial, type SerieLugar } from '@/lib/historico-lugares';

export function GraficoPorLugar({
  tipo,
  titulo,
  unidade,
  series,
}: {
  tipo: string;
  titulo: string;
  unidade: string;
  series: SerieLugar[];
}) {
  const [chave, setChave] = useState(() => lugarInicial(tipo, series));
  const selecionada = series.find((serie) => serie.chave === chave) ?? series[0];

  if (!selecionada) return <p className="cidnota">Ainda sem histórico por lugar.</p>;

  return (
    <div className="pglugar">
      <label htmlFor="lugar-do-grafico">{selecionada.chave.startsWith('praca|') ? 'Praça do gráfico' : 'Estado do gráfico'}</label>
      <select id="lugar-do-grafico" value={selecionada.chave} onChange={(evento) => setChave(evento.target.value)}>
        {series.map((serie) => <option key={serie.chave} value={serie.chave}>{serie.nome}</option>)}
      </select>
      <p className="pglugar-fonte">{selecionada.origem}</p>
      {selecionada.pontos.length > 0 ? (
        <>
          <GraficoCotacao pontos={selecionada.pontos} titulo={`${titulo} · ${selecionada.nome}`} unidade={unidade} />
          {selecionada.pontos.length < 2 && (
            <p className="pglugar-nota">
              O histórico deste lugar começou em {dataLonga(new Date(selecionada.pontos[0].data))}.
              A linha aparece quando houver outro fechamento da fonte.
            </p>
          )}
        </>
      ) : <p className="pglugar-nota">Ainda sem fechamento registrado para este lugar.</p>}
    </div>
  );
}
