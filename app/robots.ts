import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/compartilhar';

/**
 * O que o buscador pode ler.
 *
 * Tudo aberto, menos o que é do dono (`/moderar`, `/painel`) e as rotas de API — que
 * não são páginas e só sujariam o índice. O `/api/boletim` fica de fora junto: é uma
 * imagem gerada em ~8s por chamada, e robô rastreando isso queima cota à toa.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/moderar', '/painel', '/api/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
