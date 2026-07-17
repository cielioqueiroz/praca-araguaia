'use client';

import { useState } from 'react';
import { arrobasDeBoi, valorEmReais, sacasParaKg } from '@/lib/calculadora';
import { normalizarValor } from '@/lib/termometro';
import { TITULOS } from '@/lib/tipos-ui';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (s: string) => normalizarValor(s);
const precoInicial = (v?: number) =>
  v !== undefined && Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';

/** Todo preço que o painel publica pode entrar numa conta aqui. */
export type Precos = Partial<Record<string, number>>;

type GadoArroba = 'boi' | 'vaca' | 'novilha';
type Grao = 'soja' | 'milho';
// O Ibovespa fica de fora de propósito: é índice, não tem lote nem quantidade — não
// existe "quanto vale o meu Ibovespa".
type Ativo = 'dolar' | 'euro' | 'ouro' | 'bitcoin' | 'ethereum';

const UNIDADE_ATIVO: Record<Ativo, { qtd: string; preco: string }> = {
  dolar: { qtd: 'Dólares (US$)', preco: 'Cotação (R$/US$)' },
  euro: { qtd: 'Euros (€)', preco: 'Cotação (R$/€)' },
  ouro: { qtd: 'Gramas (g)', preco: 'Preço (R$/g)' },
  bitcoin: { qtd: 'Bitcoins (BTC)', preco: 'Preço (R$/BTC)' },
  ethereum: { qtd: 'Ethers (ETH)', preco: 'Preço (R$/ETH)' },
};

const campo =
  'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';
const secao = 'rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]';

function Resultado({ rotulo, valor, testId }: { rotulo: string; valor: number; testId: string }) {
  return (
    <p className="text-sm text-tinta/60">
      {rotulo}:{' '}
      <span data-testid={testId} className="font-sans text-2xl font-bold tabular-nums text-mata">
        R$ {fmt.format(valor)}
      </span>
    </p>
  );
}

export function Calculadora({ precos }: { precos: Precos }) {
  // ---------- Gado na balança: boi, vaca e novilha (a conta é a mesma, muda o preço)
  const [gado, setGado] = useState<GadoArroba>('boi');
  const [peso, setPeso] = useState('');
  const [rendimento, setRendimento] = useState('50');
  const [precoGado, setPrecoGado] = useState(precoInicial(precos.boi));
  const arrobas = arrobasDeBoi(num(peso), num(rendimento));
  const valorGado = valorEmReais(arrobas, num(precoGado));

  // ---------- Bezerro: a praça negocia por CABEÇA, não por arroba
  const [cabecas, setCabecas] = useState('');
  const [precoBezerro, setPrecoBezerro] = useState(precoInicial(precos.bezerro));
  const valorBezerro = valorEmReais(num(cabecas), num(precoBezerro));

  // ---------- Colheita
  const [grao, setGrao] = useState<Grao>('soja');
  const [sacas, setSacas] = useState('');
  const [precoGrao, setPrecoGrao] = useState(precoInicial(precos.soja));
  const kg = sacasParaKg(num(sacas));
  const valorGrao = valorEmReais(num(sacas), num(precoGrao));

  // ---------- Mercado: câmbio, ouro e cripto
  const [ativo, setAtivo] = useState<Ativo>('ouro');
  const [quantidade, setQuantidade] = useState('');
  const [precoAtivo, setPrecoAtivo] = useState(precoInicial(precos.ouro));
  const valorAtivo = valorEmReais(num(quantidade), num(precoAtivo));

  return (
    <div className="mt-8 flex flex-col gap-8">
      <section className={secao}>
        <h2 className="font-display text-lg font-bold text-mata">Gado na balança</h2>
        <p className="mt-0.5 text-sm text-tinta/50">
          Boi, vaca ou novilha: do peso vivo às arrobas de carcaça.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-medium text-tinta/70">
            Categoria
            <select
              aria-label="categoria do gado"
              value={gado}
              onChange={(e) => {
                const g = e.target.value as GadoArroba;
                setGado(g);
                setPrecoGado(precoInicial(precos[g]));
              }}
              className={campo}
            >
              {(['boi', 'vaca', 'novilha'] as GadoArroba[]).map((g) => (
                <option key={g} value={g}>
                  {TITULOS[g]}
                </option>
              ))}
            </select>
          </label>
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
            <input aria-label="preço (R$/@)" inputMode="decimal" value={precoGado} onChange={(e) => setPrecoGado(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <p className="text-sm text-tinta/60">
            Arrobas: <span data-testid="boi-arrobas" className="font-sans text-xl font-bold tabular-nums text-tinta">{fmt.format(arrobas)}</span>
          </p>
          <Resultado rotulo="Valor do lote" valor={valorGado} testId="boi-valor" />
        </div>
      </section>

      <section className={secao}>
        <h2 className="font-display text-lg font-bold text-mata">Lote de bezerro</h2>
        <p className="mt-0.5 text-sm text-tinta/50">Bezerro se compra por cabeça — não por arroba.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-tinta/70">
            Cabeças
            <input aria-label="cabeças" inputMode="decimal" value={cabecas} onChange={(e) => setCabecas(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            Preço (R$/cabeça)
            <input aria-label="preço (R$/cabeça)" inputMode="decimal" value={precoBezerro} onChange={(e) => setPrecoBezerro(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="mt-4">
          <Resultado rotulo="Valor do lote" valor={valorBezerro} testId="bezerro-valor" />
        </div>
      </section>

      <section className={secao}>
        <h2 className="font-display text-lg font-bold text-mata">Colheita de grãos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Produto
            <select
              aria-label="produto"
              value={grao}
              onChange={(e) => {
                const g = e.target.value as Grao;
                setGrao(g);
                setPrecoGrao(precoInicial(precos[g]));
              }}
              className={campo}
            >
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
          <Resultado rotulo="Valor da colheita" valor={valorGrao} testId="graos-valor" />
        </div>
      </section>

      <section className={secao}>
        <h2 className="font-display text-lg font-bold text-mata">Mercado</h2>
        <p className="mt-0.5 text-sm text-tinta/50">
          Quanto vale, em real, o que você tem em dólar, euro, ouro ou cripto.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-tinta/70">
            Ativo
            <select
              aria-label="ativo"
              value={ativo}
              onChange={(e) => {
                const a = e.target.value as Ativo;
                setAtivo(a);
                setPrecoAtivo(precoInicial(precos[a]));
              }}
              className={campo}
            >
              {(Object.keys(UNIDADE_ATIVO) as Ativo[]).map((a) => (
                <option key={a} value={a}>
                  {TITULOS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            {UNIDADE_ATIVO[ativo].qtd}
            <input
              aria-label="quantidade"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className={campo}
            />
          </label>
          <label className="block text-sm font-medium text-tinta/70">
            {UNIDADE_ATIVO[ativo].preco}
            <input
              aria-label="preço do ativo"
              inputMode="decimal"
              value={precoAtivo}
              onChange={(e) => setPrecoAtivo(e.target.value)}
              className={campo}
            />
          </label>
        </div>
        <div className="mt-4">
          <Resultado rotulo="Vale hoje" valor={valorAtivo} testId="mercado-valor" />
        </div>
      </section>
    </div>
  );
}
