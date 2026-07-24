'use client';

import { useState } from 'react';
import { arrobasDeBoi, valorEmReais, sacasParaKg } from '@/lib/calculadora';
import { normalizarValor } from '@/lib/termometro';
import { TITULOS } from '@/lib/tipos-ui';
import { ValorContado } from '@/components/redesign/ValorContado';

// Quantidades (arrobas, kg) mostram até 2 casas sem forçar o ",00"; o dinheiro é o
// ValorContado, que sempre traz as duas casas.
const fmtQtd = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (s: string) => normalizarValor(s);
const precoInicial = (v?: number) =>
  v !== undefined && Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';

/** Todo preço que o painel publica pode entrar numa conta aqui. */
export type Precos = Partial<Record<string, number>>;

// Boi e vaca vão na BALANÇA (R$/@): a conta é peso vivo → arrobas de carcaça.
type GadoArroba = 'boi' | 'vaca';
// Bezerro e novilha são REPOSIÇÃO (R$/cabeça): a praça negocia por cabeça, não por
// arroba. Novilha estava na balança e por isso saía 13× o valor — a arroba multiplicava
// um preço que já era por cabeça. Ver lib/termometro.ts e lib/fontes/pecuaria.ts.
type Reposicao = 'bezerro' | 'novilha';
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

function Campo({
  rotulo,
  valor,
  onChange,
  aria,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  aria: string;
}) {
  return (
    <label className="ccampo">
      <span>{rotulo}</span>
      <input aria-label={aria} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Calculadora({ precos }: { precos: Precos }) {
  // ---------- Boi e vaca na balança: do peso vivo às arrobas de carcaça (R$/@)
  const [gado, setGado] = useState<GadoArroba>('boi');
  const [peso, setPeso] = useState('');
  const [rendimento, setRendimento] = useState('50');
  const [precoGado, setPrecoGado] = useState(precoInicial(precos.boi));
  const arrobas = arrobasDeBoi(num(peso), num(rendimento));
  const valorGado = valorEmReais(arrobas, num(precoGado));

  // ---------- Reposição: bezerro e novilha, por CABEÇA (R$/cabeça)
  const [reposicao, setReposicao] = useState<Reposicao>('bezerro');
  const [cabecas, setCabecas] = useState('');
  const [precoReposicao, setPrecoReposicao] = useState(precoInicial(precos.bezerro));
  const valorReposicao = valorEmReais(num(cabecas), num(precoReposicao));

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
    <div className="calc" data-grupo-cartoes>
      {/* ---------- Boi e vaca (balança) ---------- */}
      <section className="csec" data-cartao>
        <div className="cshead">
          <h2>Boi e vaca na balança</h2>
          <p>Do peso vivo às arrobas de carcaça — a arroba é 15 kg de carcaça.</p>
        </div>
        <div className="cgrid quatro">
          <label className="ccampo">
            <span>Categoria</span>
            <select
              aria-label="categoria do gado"
              value={gado}
              onChange={(e) => {
                const g = e.target.value as GadoArroba;
                setGado(g);
                setPrecoGado(precoInicial(precos[g]));
              }}
            >
              {(['boi', 'vaca'] as GadoArroba[]).map((g) => (
                <option key={g} value={g}>
                  {TITULOS[g]}
                </option>
              ))}
            </select>
          </label>
          <Campo rotulo="Peso vivo (kg)" aria="peso vivo (kg)" valor={peso} onChange={setPeso} />
          <Campo rotulo="Rendimento (%)" aria="rendimento (%)" valor={rendimento} onChange={setRendimento} />
          <Campo rotulo="Preço (R$/@)" aria="preço (R$/@)" valor={precoGado} onChange={setPrecoGado} />
        </div>
        <div className="cresultado">
          <span className="cqtd">
            <b data-testid="boi-arrobas">{fmtQtd.format(arrobas)}</b> arrobas
          </span>
          <span className="cvalor">
            Valor do lote <ValorContado valor={valorGado} testId="boi-valor" />
          </span>
        </div>
      </section>

      {/* ---------- Reposição: bezerro e novilha (por cabeça) ---------- */}
      <section className="csec" data-cartao>
        <div className="cshead">
          <h2>Reposição — bezerro e novilha</h2>
          <p>Comprados por cabeça, nunca por arroba: é a fêmea e o macho de recria da praça.</p>
        </div>
        <div className="cgrid tres">
          <label className="ccampo">
            <span>Categoria</span>
            <select
              aria-label="categoria de reposição"
              value={reposicao}
              onChange={(e) => {
                const r = e.target.value as Reposicao;
                setReposicao(r);
                setPrecoReposicao(precoInicial(precos[r]));
              }}
            >
              {(['bezerro', 'novilha'] as Reposicao[]).map((r) => (
                <option key={r} value={r}>
                  {TITULOS[r]}
                </option>
              ))}
            </select>
          </label>
          <Campo rotulo="Cabeças" aria="cabeças" valor={cabecas} onChange={setCabecas} />
          <Campo rotulo="Preço (R$/cabeça)" aria="preço (R$/cabeça)" valor={precoReposicao} onChange={setPrecoReposicao} />
        </div>
        <div className="cresultado">
          <span className="cvalor">
            Valor do lote <ValorContado valor={valorReposicao} testId="reposicao-valor" />
          </span>
        </div>
      </section>

      {/* ---------- Colheita de grãos ---------- */}
      <section className="csec" data-cartao>
        <div className="cshead">
          <h2>Colheita de grãos</h2>
          <p>Soja e milho, da saca de 60 kg ao valor da lavoura.</p>
        </div>
        <div className="cgrid tres">
          <label className="ccampo">
            <span>Produto</span>
            <select
              aria-label="produto"
              value={grao}
              onChange={(e) => {
                const g = e.target.value as Grao;
                setGrao(g);
                setPrecoGrao(precoInicial(precos[g]));
              }}
            >
              <option value="soja">Soja</option>
              <option value="milho">Milho</option>
            </select>
          </label>
          <Campo rotulo="Sacas (60 kg)" aria="sacas" valor={sacas} onChange={setSacas} />
          <Campo rotulo="Preço (R$/sc)" aria="preço (R$/sc)" valor={precoGrao} onChange={setPrecoGrao} />
        </div>
        <div className="cresultado">
          <span className="cqtd">
            <b data-testid="graos-kg">{fmtQtd.format(kg)}</b> kg
          </span>
          <span className="cvalor">
            Valor da colheita <ValorContado valor={valorGrao} testId="graos-valor" />
          </span>
        </div>
      </section>

      {/* ---------- Mercado ---------- */}
      <section className="csec" data-cartao>
        <div className="cshead">
          <h2>Mercado</h2>
          <p>Quanto vale, em real, o que você tem em dólar, euro, ouro ou cripto.</p>
        </div>
        <div className="cgrid tres">
          <label className="ccampo">
            <span>Ativo</span>
            <select
              aria-label="ativo"
              value={ativo}
              onChange={(e) => {
                const a = e.target.value as Ativo;
                setAtivo(a);
                setPrecoAtivo(precoInicial(precos[a]));
              }}
            >
              {(Object.keys(UNIDADE_ATIVO) as Ativo[]).map((a) => (
                <option key={a} value={a}>
                  {TITULOS[a]}
                </option>
              ))}
            </select>
          </label>
          <Campo rotulo={UNIDADE_ATIVO[ativo].qtd} aria="quantidade" valor={quantidade} onChange={setQuantidade} />
          <Campo rotulo={UNIDADE_ATIVO[ativo].preco} aria="preço do ativo" valor={precoAtivo} onChange={setPrecoAtivo} />
        </div>
        <div className="cresultado">
          <span className="cvalor">
            Vale hoje <ValorContado valor={valorAtivo} testId="mercado-valor" />
          </span>
        </div>
      </section>
    </div>
  );
}
