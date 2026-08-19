import Link from 'next/link';
import { Logo } from './Logo';
import { LocalUsuario } from './LocalUsuario';
import { BotaoTelegram } from './BotaoTelegram';
import { creditoFonte } from '@/lib/tipos-ui';

const NAV = [
  { href: '/', rotulo: 'Notícias do mercado' },
  { href: '/cotacoes', rotulo: 'A praça hoje' },
  { href: '/boletim', rotulo: 'Boletim do dia' },
  { href: '/chuva', rotulo: 'Chuva na região' },
  { href: '/termometro', rotulo: 'Termômetro da praça' },
  { href: '/fornecedores', rotulo: 'Fornecedores' },
  { href: '/calculadora', rotulo: 'Calculadora' },
];

// O crédito sai do FONTE_PORTEIRA para não haver dois lugares dizendo quem apurou o
// preço do gado. Aqui há linha inteira de texto, então vai o crédito por extenso —
// quem apura E onde lemos (ADR 0001).
const FONTES = [
  `Boi, vaca, novilha e bezerro: ${creditoFonte('boi')}`,
  `Grãos: ${creditoFonte('soja')}`,
  'Câmbio e ouro: BCB, gold-api',
  'Chuva: INMET, CEMADEN, Open-Meteo',
  'Termômetro: reportes da praça',
  'Notícias: veículos de origem, via RSS',
];

const SITE = 'https://cielio-portfolio.vercel.app/';

function Titulo({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-olive">{children}</div>;
}

function IconeSite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3z" />
    </svg>
  );
}

// Rodapé editorial. Contato/e-mail fictícios por enquanto (o dono ajusta depois).
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
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Cotações do agro</div>
            </div>
          </div>
          <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-ink2/85">
            A praça do Vale do Araguaia num lugar só. Cotações que importam, chuva, o preço na voz de quem está na lida
            e a conta da porteira. De graça, todo dia.
          </p>
          <BotaoTelegram className="group mt-6 inline-flex items-center gap-2.5 rounded-xl bg-olive px-5 py-3 font-sans text-sm font-semibold text-bone shadow-[0_2px_6px_rgba(38,48,26,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-olive-deep hover:shadow-[0_10px_24px_-8px_rgba(38,48,26,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive" />
        </div>

        {/* Navegação */}
        <nav aria-label="Rodapé">
          <Titulo>Navegue</Titulo>
          <ul className="mt-5 flex flex-col gap-3">
            {NAV.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  // inline-block + py-1: 24px de alvo de toque (WCAG 2.5.8), sem mudar o desenho.
                  className="inline-block py-1 text-[15px] text-ink2 transition hover:text-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
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
              href={SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-6 items-center gap-2 py-1 font-mono text-[12px] tracking-[0.02em] text-ink2 transition hover:text-olive"
            >
              <IconeSite className="h-4 w-4" />
              Criado por Cielio Queiroz
            </a>
          </div>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-4 px-[26px] py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-[15px] italic text-ink2">
            “A boiada não olha o gráfico, mas quem cuida dela, sim.”
          </p>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <LocalUsuario />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              © 2026 Praça Araguaia
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
