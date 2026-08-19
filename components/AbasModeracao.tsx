'use client';

import { useState } from 'react';
import { FilaModeracao } from '@/components/FilaModeracao';
import { FilaFornecedores } from '@/components/FilaFornecedores';
import { FormReporteApurado } from '@/components/FormReporteApurado';
import type { ReportePendente } from '@/lib/moderacao-tipos';
import type { FornecedorModeravel } from '@/lib/fornecedores';

export function AbasModeracao({
  reportes,
  agora,
  fornecedoresPendentes,
  fornecedoresAprovados,
}: {
  reportes: ReportePendente[];
  agora: number;
  fornecedoresPendentes: FornecedorModeravel[];
  fornecedoresAprovados: FornecedorModeravel[];
}) {
  const [aba, setAba] = useState<'precos' | 'fornecedores'>('precos');
  const tab = (ativo: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto ${
      ativo ? 'bg-mata text-white' : 'border border-linha bg-papel text-tinta/60 hover:bg-linha/60'
    }`;

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <button type="button" onClick={() => setAba('precos')} className={tab(aba === 'precos')}>
          Preços ({reportes.length})
        </button>
        <button type="button" onClick={() => setAba('fornecedores')} className={tab(aba === 'fornecedores')}>
          Fornecedores ({fornecedoresPendentes.length})
        </button>
      </div>
      {aba === 'precos' ? (
        <div className="flex flex-col gap-6">
          {/* O lançamento vem ANTES da fila: com a fila vazia (que é o estado de hoje),
              a aba de preços não podia ser uma tela sem nada a fazer. */}
          <FormReporteApurado />
          <FilaModeracao pendentes={reportes} agora={agora} />
        </div>
      ) : (
        <FilaFornecedores pendentes={fornecedoresPendentes} aprovados={fornecedoresAprovados} />
      )}
    </div>
  );
}
