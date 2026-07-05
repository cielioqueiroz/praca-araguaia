'use client';

import { useState } from 'react';
import { arrobasDeBoi, valorEmReais, sacasParaKg } from '@/lib/calculadora';
import { normalizarValor } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (s: string) => normalizarValor(s);
const precoInicial = (v?: number) => (v !== undefined && Number.isFinite(v) ? String(v) : '');

type Precos = { boi?: number; soja?: number; milho?: number };
type ProdutoGrao = 'soja' | 'milho';

const campo =
  'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';

export function Calculadora({ precos }: { precos: Precos }) {
  // Boi
  const [peso, setPeso] = useState('');
  const [rendimento, setRendimento] = useState('50');
  const [precoBoi, setPrecoBoi] = useState(precoInicial(precos.boi));
  const arrobas = arrobasDeBoi(num(peso), num(rendimento));
  const valorBoi = valorEmReais(arrobas, num(precoBoi));

  // Grãos
  const [produto, setProduto] = useState<ProdutoGrao>('soja');
  const [sacas, setSacas] = useState('');
  const [precoGrao, setPrecoGrao] = useState(precoInicial(precos.soja));
  const kg = sacasParaKg(num(sacas));
  const valorGrao = valorEmReais(num(sacas), num(precoGrao));

  function trocarProduto(p: ProdutoGrao) {
    setProduto(p);
    setPrecoGrao(precoInicial(precos[p]));
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <section className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
        <h2 className="font-display text-lg font-bold text-mata">Lote de boi gordo</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Peso vivo (kg)
            <input aria-label="peso vivo (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Rendimento (%)
            <input aria-label="rendimento (%)" inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Preço (R$/@)
            <input aria-label="preço (R$/@)" inputMode="decimal" value={precoBoi} onChange={(e) => setPrecoBoi(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="text-sm text-tinta/60">
            Arrobas: <span data-testid="boi-arrobas" className="font-display text-xl font-bold tabular-nums text-tinta">{fmt.format(arrobas)}</span>
          </p>
          <p className="text-sm text-tinta/60">
            Valor do lote: <span data-testid="boi-valor" className="font-display text-2xl font-bold tabular-nums text-mata">R$ {fmt.format(valorBoi)}</span>
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
        <h2 className="font-display text-lg font-bold text-mata">Colheita de grãos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Produto
            <select aria-label="produto" value={produto} onChange={(e) => trocarProduto(e.target.value as ProdutoGrao)} className={campo}>
              <option value="soja">Soja</option>
              <option value="milho">Milho</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Sacas (60 kg)
            <input aria-label="sacas" inputMode="decimal" value={sacas} onChange={(e) => setSacas(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Preço (R$/sc)
            <input aria-label="preço (R$/sc)" inputMode="decimal" value={precoGrao} onChange={(e) => setPrecoGrao(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="text-sm text-tinta/60">
            Equivale a <span data-testid="graos-kg" className="font-semibold tabular-nums text-tinta">{fmt.format(kg)}</span> kg
          </p>
          <p className="text-sm text-tinta/60">
            Valor da colheita: <span data-testid="graos-valor" className="font-display text-2xl font-bold tabular-nums text-mata">R$ {fmt.format(valorGrao)}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
