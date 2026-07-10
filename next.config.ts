import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Esconde o indicador de dev do Next (o botão "N") — era só no dev, nunca em produção.
  devIndicators: false,
};

export default nextConfig;
