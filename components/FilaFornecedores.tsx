'use client';

import { useState } from 'react';
import type { FornecedorModeravel, DecisaoFornecedor } from '@/lib/fornecedores';

const btnAprovar = 'rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto';
const btnSecundario = 'rounded-lg border border-linha bg-papel px-4 py-3 text-sm font-semibold text-tinta/70 transition hover:border-tinta/30 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto';

function Cartao({ f, children }: { f: FornecedorModeravel; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-tinta">{f.nome}</h3>
        <span className="text-xs uppercase tracking-[0.08em] text-tinta/50">{f.categoriaRotulo}</span>
      </div>
      <p className="mt-1 text-sm text-tinta/60">{f.oQueVende}</p>
      <p className="mt-0.5 text-sm text-tinta/60">{f.municipio} · {f.whatsapp}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function FilaFornecedores({
  pendentes,
  aprovados,
}: {
  pendentes: FornecedorModeravel[];
  aprovados: FornecedorModeravel[];
}) {
  const [filaPend, setFilaPend] = useState(pendentes);
  const [filaApro, setFilaApro] = useState(aprovados);
  const [erro, setErro] = useState<string | null>(null);

  type Setter = React.Dispatch<React.SetStateAction<FornecedorModeravel[]>>;

  async function decidir(f: FornecedorModeravel, decisao: DecisaoFornecedor, setLista: Setter) {
    setErro(null);
    setLista((prev) => prev.filter((x) => x.id !== f.id)); // otimista
    const devolver = () => setLista((prev) => (prev.some((x) => x.id === f.id) ? prev : [f, ...prev]));
    try {
      const res = await fetch('/api/moderar/fornecedor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: f.id, decisao }),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (res.ok || res.status === 404) return; // 404: já resolvido — segue removido
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      devolver();
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
    } catch {
      devolver();
      setErro('Sem conexão. Tente de novo.');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">Esperando decisão ({filaPend.length})</h2>
        {filaPend.length === 0 ? (
          <p className="text-sm text-tinta/50">Nenhum cadastro pendente.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filaPend.map((f) => (
              <Cartao key={f.id} f={f}>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => decidir(f, 'aprovado', setFilaPend)} className={btnAprovar}>Aprovar</button>
                  <button type="button" onClick={() => decidir(f, 'rejeitado', setFilaPend)} className={btnSecundario}>Rejeitar</button>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">No ar ({filaApro.length})</h2>
        {filaApro.length === 0 ? (
          <p className="text-sm text-tinta/50">Nenhum fornecedor no ar ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filaApro.map((f) => (
              <Cartao key={f.id} f={f}>
                <button type="button" onClick={() => decidir(f, 'removido', setFilaApro)} className={btnSecundario}>Remover do ar</button>
              </Cartao>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
