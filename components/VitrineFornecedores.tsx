'use client';

import { useState } from 'react';
import { CATEGORIAS, agruparPorCategoria, type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { CardFornecedor } from '@/components/CardFornecedor';

export function VitrineFornecedores({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [categoria, setCategoria] = useState<CategoriaFornecedor | null>(null);

  if (fornecedores.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-linha bg-papel/60 p-8 text-center">
        <p className="font-display text-lg font-bold text-mata">Vitrine em breve — estamos reunindo os fornecedores da praça.</p>
        <p className="mt-1 text-sm text-tinta/50">Volte logo: a lista da praça está sendo montada.</p>
      </div>
    );
  }

  const grupos = agruparPorCategoria(fornecedores, categoria);
  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto ${
      ativo ? 'bg-mata text-white' : 'border border-linha bg-papel text-tinta/60 hover:bg-linha/60'
    }`;

  return (
    <div>
      <div className="mb-6 mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategoria(null)} className={chip(categoria === null)}>
          Todas
        </button>
        {CATEGORIAS.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategoria(c.id)} className={chip(categoria === c.id)}>
            {c.rotulo}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhum fornecedor nesta categoria ainda.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {grupos.map((g) => (
            <section key={g.categoria}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-tinta/70">{g.rotulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.fornecedores.map((f) => (
                  <CardFornecedor key={`${f.nome}-${f.municipio}`} fornecedor={f} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
