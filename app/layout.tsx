import type { Metadata } from 'next';
import './globals.css';
import { Playfair_Display, Archivo, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { UtilityBar } from '@/components/redesign/UtilityBar';
import { Masthead } from '@/components/redesign/Masthead';
import { SiteFooter } from '@/components/redesign/SiteFooter';

// Nomes de var mantidos (--font-fraunces/hanken/plex-mono) para não churnar o CSS.
const display = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-fraunces' });
const sans = Archivo({ subsets: ['latin'], variable: '--font-hanken' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://agroapp-bay.vercel.app'),
  title: 'Praça Araguaia — cotações do agro',
  description: 'Cotações agropecuárias diárias para o produtor rural do Araguaia.',
  openGraph: {
    title: 'Praça Araguaia — cotações do agro',
    description: 'Cotações agropecuárias diárias para o produtor rural do Araguaia.',
    url: 'https://agroapp-bay.vercel.app',
    siteName: 'Praça Araguaia',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Praça Araguaia — cotações do agro',
    description: 'Cotações agropecuárias diárias para o produtor rural do Araguaia.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn(display.variable, sans.variable, mono.variable)}>
      <body className="grain flex min-h-screen flex-col bg-bone font-sans text-ink antialiased">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6b8339" stopOpacity=".18" />
              <stop offset="1" stopColor="#6b8339" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a63a26" stopOpacity=".16" />
              <stop offset="1" stopColor="#a63a26" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <UtilityBar />
        <Masthead />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
