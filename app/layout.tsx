import type { Metadata } from 'next';
import './globals.css';

export const metadata = {
  title: 'Praça Araguaia — Cotações',
  description: 'Cotações diárias para o produtor rural do Araguaia.',
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
