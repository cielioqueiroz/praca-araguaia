'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

const LINKS = [
  { href: '/', rotulo: 'A praça hoje' },
  { href: '/boletim', rotulo: 'Boletim' },
  { href: '/chuva', rotulo: 'Chuva' },
  { href: '/termometro', rotulo: 'Termômetro' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

export function Masthead() {
  const pathname = usePathname();
  const ativo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="masthead">
      <div className="row">
        <Link href="/" className="brand" aria-label="Praça Araguaia — início">
          <Logo />
          <div>
            <div className="word">Praça Araguaia</div>
            <div className="sub">Cotações do agro, 2024</div>
          </div>
        </Link>

        <nav className="nav" aria-label="Principal">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={ativo(l.href) ? 'active' : ''}
              aria-current={ativo(l.href) ? 'page' : undefined}
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="tools">
          <div className="search">
            <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input placeholder="Buscar praça, produto…" aria-label="Buscar" />
          </div>
        </div>
      </div>
      <div className="goldrule" />
    </header>
  );
}
