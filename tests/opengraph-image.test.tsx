import { describe, it, expect, vi } from 'vitest';

// ImageResponse real depende de WASM (Satori/resvg) — mock devolve um Response.
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor() {
      return new Response('png-simulado', { status: 200, headers: { 'content-type': 'image/png' } });
    }
  },
}));

import OgImage, { size, contentType, alt } from '@/app/opengraph-image';

describe('opengraph-image', () => {
  it('exporta tamanho 1200×630, PNG e alt de marca', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(alt).toMatch(/Praça Araguaia/);
  });

  it('renderiza uma imagem', () => {
    const res = OgImage() as unknown as Response;
    expect(res.headers.get('content-type')).toMatch(/^image\//);
  });
});
