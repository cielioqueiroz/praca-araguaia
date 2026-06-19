import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Praça Araguaia',
  description: 'Plataforma agtech — cotação do dólar',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
