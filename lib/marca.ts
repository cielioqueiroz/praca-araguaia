// Fonte única da marca: o "Broto no sulco" (19B).
// O site desenha por Logo.tsx; o favicon (app/icon.svg), o card do Telegram e o
// Open Graph consomem daqui — assim a marca não sai de sincronia entre eles.

export const MARCA = {
  olive: '#3f4a24',
  bone: '#f1ebde',
  musgo: '#6b8339',
  couro: '#6e3e1e',
} as const;

// Miolo do desenho em viewBox 0 0 48 48, sem o <svg> em volta.
// A folha vem no grupo .vt-folha: quem quiser vento é só ligar a classe .vt no <svg>.
export const MARCA_MIOLO = `
<circle cx="24" cy="24" r="24" fill="${MARCA.bone}"/>
<circle cx="24" cy="24" r="23" fill="none" stroke="${MARCA.olive}" stroke-width="1.2"/>
<g class="vt-folha" style="transform-origin:24px 34px">
  <path d="M24 34c0-9 3-14 11-16 1 10-4 15-11 16z" fill="${MARCA.musgo}"/>
  <path d="M24 34c0-7-3-11-9-12 0 8 3 11 9 12z" fill="${MARCA.olive}"/>
  <path d="M24 34V19" stroke="${MARCA.olive}" stroke-width="1.6" stroke-linecap="round"/>
</g>
<path d="M8 36c9 3 23 3 32-1" fill="none" stroke="${MARCA.couro}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M11 41c8 2 19 2 26-1" fill="none" stroke="${MARCA.couro}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>
`.trim();

export function marcaSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${MARCA_MIOLO}</svg>`;
}

// data: URI — o Satori (ImageResponse) não desenha SVG inline, mas desenha <img>.
export function marcaDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(marcaSvg()).toString('base64')}`;
}
