'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

const LINKS = [
  { href: '/', rotulo: 'Notícias' },
  { href: '/cotacoes', rotulo: 'A praça hoje' },
  { href: '/boletim', rotulo: 'Boletim' },
  { href: '/chuva', rotulo: 'Chuva' },
  { href: '/termometro', rotulo: 'Termômetro' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

function IconeBusca() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export function Masthead() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  // Fecha a gaveta ao navegar — o Next mantém o componente montado entre rotas.
  useEffect(() => setAberto(false), [pathname]);

  // Enquanto a gaveta está aberta ela cobre a tela: trava o scroll do fundo e ouve o Esc.
  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', onKey);
    };
  }, [aberto]);

  return (
    <header className="masthead">
      <div className="row">
        <Link href="/" className="brand" aria-label="Praça Araguaia — início">
          <Logo />
          <div>
            <div className="word">Praça Araguaia</div>
            <div className="sub">Cotações do agro</div>
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
            <IconeBusca />
            <input placeholder="Buscar praça, produto…" aria-label="Buscar" />
          </div>
        </div>

        <button
          type="button"
          className={`burger${aberto ? ' aberto' : ''}`}
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={aberto}
          aria-controls="menu-gaveta"
        >
          <span className="traco" />
          <span className="traco" />
          <span className="traco" />
        </button>
      </div>
      <div className="goldrule" />

      {/* Gaveta mobile: só existe abaixo de 900px (o CSS esconde o botão acima disso). */}
      <div
        className={`gaveta-fundo${aberto ? ' aberto' : ''}`}
        onClick={() => setAberto(false)}
        aria-hidden="true"
      />
      <nav id="menu-gaveta" className={`gaveta${aberto ? ' aberto' : ''}`} aria-label="Menu" aria-hidden={!aberto}>
        <div className="gaveta-busca">
          <IconeBusca />
          <input placeholder="Buscar praça, produto…" aria-label="Buscar" tabIndex={aberto ? 0 : -1} />
        </div>
        <ul>
          {LINKS.map((l, i) => (
            <li key={l.href} style={{ transitionDelay: aberto ? `${60 + i * 35}ms` : '0ms' }}>
              <Link
                href={l.href}
                className={ativo(l.href) ? 'active' : ''}
                aria-current={ativo(l.href) ? 'page' : undefined}
                tabIndex={aberto ? 0 : -1}
                onClick={() => setAberto(false)}
              >
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                {l.rotulo}
              </Link>
            </li>
          ))}
        </ul>
        <div className="gaveta-pe">Criado por Cielio Queiroz</div>
      </nav>
    </header>
  );
}
