'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FormLoginModeracao() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/moderar/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (res.ok) {
        router.refresh(); // recarrega a página já autenticada; botão fica desabilitado até lá
        return;
      }
      const body = (await res.json().catch(() => null)) as { erro?: string } | null;
      setErro(body?.erro ?? 'Não deu certo. Tente de novo.');
      setEnviando(false);
    } catch {
      setErro('Sem conexão. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-tinta/70">
        Senha
        <input
          type="password"
          required
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full rounded-lg border border-linha bg-papel px-3 py-2.5 text-base text-tinta focus-visible:outline-2 focus-visible:outline-pasto"
        />
      </label>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-pasto px-4 py-3 text-sm font-semibold text-white transition hover:bg-mata disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
