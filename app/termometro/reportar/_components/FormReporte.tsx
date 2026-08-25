'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO, normalizarValor, type ProdutoTermometro } from '@/lib/termometro';

export function FormReporte() {
  // O card da porteira manda ?produto=<tipo>: o formulário já abre no item certo.
  // (Fora do router — em teste de unidade — o hook devolve null; cai no boi.)
  const params = useSearchParams();
  const pedido = params?.get('produto');
  const inicial: ProdutoTermometro = pedido && pedido in PRODUTOS ? (pedido as ProdutoTermometro) : 'boi';

  const [produto, setProduto] = useState<ProdutoTermometro>(inicial);
  const [municipio, setMunicipio] = useState(MUNICIPIOS_TERMOMETRO[0]);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="pgvazio" role="status">
        <h2>Recebido!</h2>
        <p></p>
      </div>
    );
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const contato = String(new FormData(e.currentTarget).get('contato') ?? '');
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/reportar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ produto, municipio, valor: normalizarValor(valor), contato }),
      });
      if (res.ok) {
        setEnviado(true);
      } else {
        const body = (await res.json().catch(() => null)) as { erro?: string } | null;
        setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
      }
    } catch {
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="pgform">
      <label>
        Produto
        <select value={produto} onChange={(e) => setProduto(e.target.value as ProdutoTermometro)}>
          {ORDEM_PRODUTOS.map((p) => (
            <option key={p} value={p}>
              {PRODUTOS[p].rotulo} ({PRODUTOS[p].unidade})
            </option>
          ))}
        </select>
      </label>

      <label>
        Município
        <select value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
          {MUNICIPIOS_TERMOMETRO.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label>
        Preço ({PRODUTOS[produto].unidade})
        <input
          type="text" inputMode="decimal" required value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={`ex.: ${PRODUTOS[produto].min + Math.round((PRODUTOS[produto].max - PRODUTOS[produto].min) / 2)}`}
        />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="pgerro" role="alert">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar preço'}
      </button>
    </form>
  );
}
