'use client';

import { useState } from 'react';
import { PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO, normalizarValor, type ProdutoTermometro } from '@/lib/termometro';

export function FormReporte() {
  const [produto, setProduto] = useState<ProdutoTermometro>('boi');
  const [municipio, setMunicipio] = useState(MUNICIPIOS_TERMOMETRO[0]);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="rounded-xl border border-linha bg-papel p-6">
        <p className="font-display text-xl font-bold text-mata">Recebido!</p>
        <p className="mt-1 text-sm text-tinta/60">Seu preço entra na média depois de conferido. Obrigado por fortalecer a praça.</p>
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

  const campo = 'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-tinta/70">
        Produto
        <select value={produto} onChange={(e) => setProduto(e.target.value as ProdutoTermometro)} className={campo}>
          {ORDEM_PRODUTOS.map((p) => (
            <option key={p} value={p}>
              {PRODUTOS[p].rotulo} ({PRODUTOS[p].unidade})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Município
        <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={campo}>
          {MUNICIPIOS_TERMOMETRO.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Preço ({PRODUTOS[produto].unidade})
        <input
          type="text" inputMode="decimal" required value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={`ex.: ${PRODUTOS[produto].min + Math.round((PRODUTOS[produto].max - PRODUTOS[produto].min) / 2)}`}
          className={campo}
        />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit" disabled={enviando}
        className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        {enviando ? 'Enviando…' : 'Enviar preço'}
      </button>
    </form>
  );
}
