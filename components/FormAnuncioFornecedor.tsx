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

  return (
    <form onSubmit={enviar} className="pgform">
      <label>
        Nome do fornecedor
        <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>

      <label>
        Categoria
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaFornecedor)}>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>{c.rotulo}</option>
          ))}
        </select>
      </label>

      <label>
        O que vende
        <input type="text" required value={oQueVende} onChange={(e) => setOQueVende(e.target.value)} placeholder="ex.: ração, sal mineral, sementes" />
      </label>

      <label>
        Município
        <input type="text" required value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
      </label>

      <label>
        WhatsApp (com DDD)
        <input type="text" inputMode="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="ex.: (94) 99999-8888" />
      </label>

      {/* honeypot: humano não vê nem preenche */}
      <input type="text" name="contato" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p className="pgerro" role="alert">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar cadastro'}
      </button>
    </form>
  );
}
