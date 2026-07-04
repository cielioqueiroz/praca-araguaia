'use client';

import { useState } from 'react';
import { tempoRelativo, type ReportePendente, type Decisao } from '@/lib/moderacao';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function FilaModeracao({ pendentes, agora }: { pendentes: ReportePendente[]; agora: number }) {
  const [fila, setFila] = useState(pendentes);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: string, decisao: Decisao) {
    const indice = fila.findIndex((r) => r.id === id);
    const card = fila[indice];
    setErro(null);
    setFila((prev) => prev.filter((r) => r.id !== id)); // otimista: some na hora

    // No erro, reinsere só o card desta decisão, na posição original —
    // decisões concorrentes que deram certo continuam fora da fila.
    const devolverCard = () =>
      setFila((prev) => {
        if (!card || prev.some((r) => r.id === card.id)) return prev;
        const copia = [...prev];
        copia.splice(Math.min(indice, copia.length), 0, card);
        return copia;
      });

    try {
      const res = await fetch('/api/moderar/decidir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, decisao }),
      });
      if (res.status === 401) {
        window.location.reload(); // sessão expirou → cai na tela de senha
        return;
      }
      if (res.ok || res.status === 404) return; // 404: já moderado — segue removido
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      devolverCard();
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
    } catch {
      devolverCard();
      setErro('Sem conexão. Tente de novo.');
    }
  }

  if (fila.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
        <p className="font-display text-lg font-bold text-mata">Fila limpa — nenhum reporte pendente.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
      {fila.map((r) => (
        <div key={r.id} className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta/60">{r.rotulo}</h2>
            <span className="text-xs text-tinta/40">{tempoRelativo(r.criadoEm, agora)}</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-tinta">
            {fmt.format(r.valor)} <span className="text-sm font-semibold text-pasto">{r.unidade}</span>
          </p>
          <p className="mt-1 text-sm text-tinta/60">{r.municipio}</p>
          {r.mediaConab !== undefined && (
            <p className="mt-1 text-xs text-tinta/50">CONAB: {fmt.format(r.mediaConab)}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => decidir(r.id, 'aprovado')}
              className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => decidir(r.id, 'rejeitado')}
              className="rounded-lg border border-linha bg-papel px-4 py-3 text-sm font-semibold text-tinta/70 transition hover:border-tinta/30 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
            >
              Rejeitar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
