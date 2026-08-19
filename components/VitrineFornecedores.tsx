'use client';

import { useState } from 'react';
import { CATEGORIAS, agruparPorCategoria, type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { CardFornecedor } from '@/components/CardFornecedor';

export function VitrineFornecedores({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [categoria, setCategoria] = useState<CategoriaFornecedor | null>(null);

  if (fornecedores.length === 0) {
    return (
      <div className="pgvazio">
        <h2>Ainda não há fornecedores na vitrine</h2>
        <p>
          É o primeiro da praça? Use o botão &quot;Anuncie aqui&quot; acima: leva um minuto, é de graça, e o
          produtor fala com você direto no WhatsApp.
        </p>
      </div>
    );
  }

  const grupos = agruparPorCategoria(fornecedores, categoria);
  const chip = (ativo: boolean) => `vchip${ativo ? ' ativo' : ''}`;

  return (
    <div className="section">
      <div className="vchips">
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
        <p className="cidnota">Nenhum fornecedor nesta categoria ainda.</p>
      ) : (
        <div className="vgrupos">
          {grupos.map((g) => (
            <section key={g.categoria}>
              {/* h2 de verdade, não um div com cara de título: a categoria é o
                  cabeçalho da seção, e leitor de tela navega por ele. */}
              <div className="section-head">
                <h2 className="t">{g.rotulo}</h2>
                <div className="line" />
              </div>
              <div className="pggrade">
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
