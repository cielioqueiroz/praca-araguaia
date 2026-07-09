import type { Metadata } from 'next';
import './globals.css';
import { Geist, Bricolage_Grotesque } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });

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
    <html lang="pt-BR" className={cn('font-sans', geist.variable, bricolage.variable)}>
      <body className="flex min-h-screen flex-col bg-palha text-tinta antialiased">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
