import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarNoticias } from '@/lib/noticias/buscar';
import { FEEDS } from '@/lib/noticias/feeds';
import type { ResumoFeed } from '@/lib/noticias/agregar';

afterEach(() => vi.restoreAllMocks());

describe('observabilidade dos feeds', () => {
  it('registra uma leitura por veículo sem mudar as notícias selecionadas', async () => {
    const data = new Date().toUTCString();
    const xml = `<rss><channel>
      <item><title>Boi gordo sobe</title><link>https://g1.globo.com/boi</link>
        <pubDate>${data}</pubDate><media:content url="https://img.globo.com/boi.jpg" /></item>
      <item><title>Novela estreia hoje</title><link>https://g1.globo.com/novela</link>
        <pubDate>${data}</pubDate></item>
    </channel></rss>`;
    const buscar = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(String(url) === FEEDS[0].url ? 'indisponível' : xml, {
        status: String(url) === FEEDS[0].url ? 503 : 200,
      }));
    const informacao = vi.spyOn(console, 'info').mockImplementation(() => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const noticias = await buscarNoticias(buscar);

    expect(noticias).toHaveLength(1);
    expect(noticias[0].titulo).toBe('Boi gordo sobe');
    expect(erro).toHaveBeenCalledOnce();
    expect(informacao).toHaveBeenCalledOnce();
    const resumo = JSON.parse(String(informacao.mock.calls[0][1])) as ResumoFeed[];
    expect(resumo).toHaveLength(FEEDS.length);
    expect(resumo[0]).toMatchObject({ id: FEEDS[0].id, estado: 'falhou', recentes: null });
    expect(resumo[1]).toMatchObject({ id: FEEDS[1].id, estado: 'ok', colhidos: 2, recentes: 2, relevantes: 1 });
  });
});
