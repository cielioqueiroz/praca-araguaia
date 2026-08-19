import type { MetadataRoute } from 'next';
import { PAGINAS_PRACA } from '@/lib/pracas-paginas';
import { SITE } from '@/lib/compartilhar';

/**
 * O mapa do site para os buscadores.
 *
 * O projeto passou um ano invisível: sem sitemap, sem robots e sem URL por cidade,
 * "preço do boi hoje em Redenção" nunca teve como chegar aqui. Descoberta é a única
 * alavanca de audiência que funciona sem o dono ligar para ninguém.
 *
 * `/moderar` e `/painel` NÃO entram: são as telas do dono (a primeira já é noindex).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  const fixas: { caminho: string; prioridade: number; frequencia: 'hourly' | 'daily' | 'weekly' }[] = [
    { caminho: '', prioridade: 1, frequencia: 'hourly' },
    { caminho: '/cotacoes', prioridade: 0.9, frequencia: 'daily' },
    { caminho: '/termometro', prioridade: 0.8, frequencia: 'daily' },
    { caminho: '/boletim', prioridade: 0.7, frequencia: 'daily' },
    { caminho: '/chuva', prioridade: 0.7, frequencia: 'daily' },
    { caminho: '/calculadora', prioridade: 0.6, frequencia: 'weekly' },
    { caminho: '/fornecedores', prioridade: 0.6, frequencia: 'weekly' },
    { caminho: '/fornecedores/anunciar', prioridade: 0.4, frequencia: 'weekly' },
    { caminho: '/termometro/reportar', prioridade: 0.5, frequencia: 'weekly' },
  ];

  return [
    ...fixas.map((f) => ({
      url: `${SITE}${f.caminho}`,
      lastModified: agora,
      changeFrequency: f.frequencia,
      priority: f.prioridade,
    })),
    // As páginas de cidade: o que a pessoa realmente procura.
    ...PAGINAS_PRACA.map((p) => ({
      url: `${SITE}/praca/${p.slug}`,
      lastModified: agora,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ];
}
