'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', rotulo: 'Cotações' },
  { href: '/boletim', rotulo: 'Boletim' },
  { href: '/chuva', rotulo: 'Chuva' },
  { href: '/termometro', rotulo: 'Termômetro' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

function estaAtivo(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function NavPrincipal() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  const linkDesktop = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 font-medium transition focus-visible:outline-2 focus-visible:outline-white ${
      ativo ? 'bg-white/15 text-white' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
    }`;

  const linkGaveta = (ativo: boolean) =>
    `rounded-lg px-3 py-2.5 font-medium transition focus-visible:outline-2 focus-visible:outline-white ${
      ativo ? 'bg-white/15 text-white' : 'text-emerald-100/90 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <>
      {/* Desktop: menu inline */}
      <nav className="hidden flex-wrap justify-end gap-1 text-sm sm:flex">
        {LINKS.map((l) => {
          const ativo = estaAtivo(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} className={linkDesktop(ativo)} aria-current={ativo ? 'page' : undefined}>
              {l.rotulo}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: botão + gaveta */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        aria-controls="menu-mobile"
        className="rounded-md p-1.5 text-white focus-visible:outline-2 focus-visible:outline-white sm:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {aberto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {aberto && (
        <nav id="menu-mobile" className="mt-3 flex w-full basis-full flex-col gap-1 text-base sm:hidden">
          {LINKS.map((l) => {
            const ativo = estaAtivo(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                aria-current={ativo ? 'page' : undefined}
                className={linkGaveta(ativo)}
              >
                {l.rotulo}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
