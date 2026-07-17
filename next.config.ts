import type { NextConfig } from 'next';

// Cabeçalhos de segurança em toda resposta. Baratos e sem efeito no visual: o site
// não é embutido em iframe (clickjacking), o navegador não "adivinha" tipo de
// conteúdo, e o Referer não vaza a URL cheia para terceiros.
const SEGURANCA = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Esconde o indicador de dev do Next (o botão "N") — era só no dev, nunca em produção.
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers: SEGURANCA }];
  },
};

export default nextConfig;
