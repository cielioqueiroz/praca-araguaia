'use client';

import { useEffect, useState } from 'react';
import { municipioMaisProximo, ufDaSigla, NOME_UF } from '@/lib/praca';

type Praca = { cidade: string; uf: string };

// Descobre a praça do usuário (GPS do navegador, com queda para os headers de geo
// da Vercel) e destaca a linha dela nas listas já renderizadas pelo servidor —
// assim o painel continua sendo Server Component.
export function SuaPraca() {
  const [praca, setPraca] = useState<Praca | null>(null);

  useEffect(() => {
    // Chave própria: 'praca-loc' é da barra de topo e guarda temperatura/coordenadas —
    // gravar o objeto menor aqui apagaria aqueles campos.
    const marcar = (p: Praca) => {
      setPraca(p);
      localStorage.setItem('praca-uf', JSON.stringify(p));
      document.querySelectorAll<HTMLElement>('[data-uf]').forEach((el) => {
        el.classList.toggle('sua-praca', el.dataset.uf === p.uf);
      });
      document.querySelectorAll<HTMLElement>('[data-cidade]').forEach((el) => {
        el.classList.toggle('sua-cidade', el.dataset.cidade === p.cidade);
      });
    };

    const porIP = () =>
      fetch('/api/geo')
        .then((r) => r.json())
        .then((d: { cidade?: string; uf?: string }) => {
          const uf = ufDaSigla(d.uf ?? '');
          if (uf) marcar({ cidade: d.cidade ?? '', uf });
        })
        .catch(() => {});

    if (!navigator.geolocation) {
      void porIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = municipioMaisProximo(pos.coords.latitude, pos.coords.longitude);
        if (m) marcar({ cidade: m.nome, uf: m.uf });
        else void porIP();
      },
      () => void porIP(),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  if (!praca) return null;

  return (
    <div className="praca-tag">
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      Sua praça:&nbsp;<b>{praca.cidade ? `${praca.cidade}, ` : ''}{NOME_UF[praca.uf] ?? praca.uf}</b>
      <span className="dica">os preços da sua região aparecem destacados</span>
    </div>
  );
}
