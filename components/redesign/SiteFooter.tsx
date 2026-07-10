import Link from 'next/link';
import { Logo } from './Logo';

const NAV = [
  { href: '/', rotulo: 'A praça hoje' },
  { href: '/boletim', rotulo: 'Boletim do dia' },
  { href: '/chuva', rotulo: 'Chuva na região' },
  { href: '/termometro', rotulo: 'Termômetro da praça' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

const FONTES = [
  'Cotações · CONAB · B3 · BCB',
  'Chuva · INMET · CEMADEN · Open-Meteo',
  'Termômetro · reportes da praça',
];

// Rótulo mono reutilizado nas colunas.
function Titulo({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-olive">{children}</div>;
}

// Rodapé editorial. Dados institucionais fictícios por enquanto (o dono ajusta depois).
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-x-10 gap-y-12 px-[26px] py-14 sm:grid-cols-[1.5fr_1fr_1.1fr]">
        {/* Marca + missão + Telegram */}
        <div>
          <div className="flex items-center gap-3">
            <Logo size={42} />
            <div>
              <div className="font-display text-[26px] leading-none text-ink">Praça Araguaia</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Cotações do agro · Est. 2024
              </div>
            </div>
          </div>
          <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-ink2/85">
            A praça do Vale do Araguaia num lugar só — cotações que importam, chuva, o preço na voz de quem está na
            lida e a conta da porteira. De graça, todo dia.
          </p>
          <a
            href="https://t.me/pracaaraguaia_bot"
            className="mt-6 inline-flex items-center gap-2 border border-rule bg-paper px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-olive transition hover:border-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
          >
            Boletim no Telegram
            <span aria-hidden="true">→</span>
          </a>
        </div>

        {/* Navegação */}
        <nav aria-label="Rodapé">
          <Titulo>Navegue</Titulo>
          <ul className="mt-5 flex flex-col gap-3">
            {NAV.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[15px] text-ink2 transition hover:text-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
                >
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Fontes + contato */}
        <div>
          <Titulo>Fontes</Titulo>
          <ul className="mt-5 flex flex-col gap-2.5">
            {FONTES.map((f) => (
              <li key={f} className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <Titulo>Contato</Titulo>
            <a
              href="mailto:contato@pracaaraguaia.com.br"
              className="mt-4 inline-block font-mono text-[12px] tracking-[0.02em] text-ink2 transition hover:text-olive"
            >
              contato@pracaaraguaia.com.br
            </a>
          </div>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-3 px-[26px] py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-[15px] italic text-ink2">
            “A boiada não olha o gráfico — mas quem cuida dela, sim.”
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            © 2026 Praça Araguaia · Barra do Garças · MT
          </p>
        </div>
      </div>
    </footer>
  );
}
