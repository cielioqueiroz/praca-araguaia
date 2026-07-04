import Link from 'next/link';

const LINKS = [
  { href: '/', rotulo: 'Cotações' },
  { href: '/boletim', rotulo: 'Boletim' },
  { href: '/chuva', rotulo: 'Chuva' },
  { href: '/termometro', rotulo: 'Termômetro' },
];

export function Header() {
  return (
    <header className="bg-mata text-palha">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#15803d" />
            <line x1="16" y1="25.5" x2="16" y2="13" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M16 17.5c-.7-3.6-3.5-5.6-7.2-5.6-.4 3.9 2.5 6.8 7.2 6.8z" fill="#bbf7d0" />
            <path d="M16 14.2c.7-3.6 3.5-5.6 7.2-5.6.4 3.9-2.5 6.8-7.2 6.8z" fill="#ffffff" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight">Praça Araguaia</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 font-medium text-emerald-100/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
