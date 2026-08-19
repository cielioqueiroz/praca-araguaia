'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUTOS, ORDEM_PRODUTOS, MUNICIPIOS_TERMOMETRO, normalizarValor, type ProdutoTermometro } from '@/lib/termometro';

/**
 * Lançar um preço que a Praça apurou (ADR 0003).
 *
 * Espelha o formulário público de propósito — mesmos campos, mesma validação — para
 * o dono não ter dois modelos mentais. A diferença toda está no aviso: o que sai
 * daqui aparece assinado como "apurado pela Praça", nunca como reporte de produtor.
 */
export function FormReporteApurado() {
  const router = useRouter();
  const [produto, setProduto] = useState<ProdutoTermometro>('boi');
  const [municipio, setMunicipio] = useState(MUNICIPIOS_TERMOMETRO[0]);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvo(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/moderar/reporte', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ produto, municipio, valor: normalizarValor(valor), contato: '' }),
      });
      if (res.ok) {
        setSalvo(`${PRODUTOS[produto].rotulo} em ${municipio} — no ar.`);
        setValor('');
        // Já entra aprovado: a página recarrega para o dono ver o efeito na hora.
        router.refresh();
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

  const campo =
    'mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto';

  return (
    <section className="rounded-xl border border-dashed border-linha bg-papel/60 p-5">
      <h2 className="font-display text-lg font-bold text-mata">Lançar preço apurado</h2>
      <p className="mt-1 text-sm text-tinta/60">
        Para o que você levantou por telefone. Entra já aprovado e aparece no site como{' '}
        <strong className="font-semibold text-tinta/80">apurado pela Praça</strong> — separado do que os
        produtores mandam. Preço que você não confirmou não entra aqui.
      </p>

      <form onSubmit={enviar} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-tinta/70">
          Produto
          <select
            value={produto}
            onChange={(e) => setProduto(e.target.value as ProdutoTermometro)}
            className={campo}
          >
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
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-tinta/70">
          Preço ({PRODUTOS[produto].unidade})
          <input
            type="text"
            inputMode="decimal"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={`ex.: ${PRODUTOS[produto].min + Math.round((PRODUTOS[produto].max - PRODUTOS[produto].min) / 2)}`}
            className={campo}
          />
        </label>

        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-mata px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pasto disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
          >
            {enviando ? 'Lançando…' : 'Lançar no Termômetro'}
          </button>
          {erro && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {erro}
            </p>
          )}
          {salvo && (
            <p role="status" className="text-sm font-medium text-pasto">
              {salvo}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
