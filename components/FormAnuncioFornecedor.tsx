'use client';

import { useState } from 'react';
import { CATEGORIAS, type CategoriaFornecedor } from '@/lib/fornecedores';

export function FormAnuncioFornecedor() {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaFornecedor>(CATEGORIAS[0].id);
  const [oQueVende, setOQueVende] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="rounded-xl border border-linha bg-papel p-6">
        <p className="font-display text-xl font-bold text-mata">Recebido!</p>
        <p className="mt-1 text-sm text-tinta/60">Seu cadastro entra na vitrine depois de uma conferência rápida. Obrigado!</p>
      </div>
    );
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const contato = String(new FormData(e.currentTarget).get('contato') ?? '');
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome, categoria, oQueVende, municipio, whatsapp, contato }),
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
        Nome do fornecedor
        <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Categoria
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaFornecedor)} className={campo}>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>{c.rotulo}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        O que vende
        <input type="text" required value={oQueVende} onChange={(e) => setOQueVende(e.target.value)} placeholder="ex.: ração, sal mineral, sementes" className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        Município
        <input type="text" required value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={campo} />
      </label>

      <label className="block text-sm font-medium text-tinta/70">
        WhatsApp (com DDD)
        <input type="text" inputMode="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="ex.: (94) 99999-8888" className={campo} />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button type="submit" disabled={enviando} className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto">
        {enviando ? 'Enviando…' : 'Enviar cadastro'}
      </button>
    </form>
  );
}
