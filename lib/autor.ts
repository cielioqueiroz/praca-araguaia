// Ilustração do autor no card do boletim: um laptop com código na tela.
// Desenhada no mesmo idioma das artes dos ativos (bitcoin/ouro/dólar): volume por
// gradiente, brilho especular, bisel e sombra no chão — só que em vetor.
// Vira data: URI porque o Satori (ImageResponse) não desenha SVG inline, só <img>.

export const PROGRAMADOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="tampa" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8e99a6"/>
      <stop offset="0.45" stop-color="#5d6875"/>
      <stop offset="1" stop-color="#3c4552"/>
    </linearGradient>
    <linearGradient id="tela" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#2b3444"/>
      <stop offset="1" stop-color="#161d28"/>
    </linearGradient>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c3cbd4"/>
      <stop offset="0.5" stop-color="#97a1ac"/>
      <stop offset="1" stop-color="#66717e"/>
    </linearGradient>
    <linearGradient id="lustro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="chao" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#1b1913" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#1b1913" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- sombra no chão -->
  <ellipse cx="32" cy="55" rx="26" ry="5" fill="url(#chao)"/>

  <!-- tampa + tela -->
  <rect x="9" y="8" width="46" height="34" rx="3.5" fill="url(#tampa)"/>
  <rect x="12" y="11" width="40" height="26" rx="1.8" fill="url(#tela)"/>

  <!-- o código: linhas coloridas, com a marca do dev (&lt;/&gt; em ocre) -->
  <g stroke-linecap="round">
    <path d="M16 16h5" stroke="#b4863b" stroke-width="2"/>
    <path d="M23 16h12" stroke="#8fa55a" stroke-width="2"/>
    <path d="M19 21h8" stroke="#6f89b3" stroke-width="2"/>
    <path d="M29 21h13" stroke="#cfc7af" stroke-width="2" opacity="0.65"/>
    <path d="M19 26h14" stroke="#b4863b" stroke-width="2" opacity="0.8"/>
    <path d="M35 26h6" stroke="#8fa55a" stroke-width="2" opacity="0.7"/>
    <path d="M16 31h9" stroke="#cfc7af" stroke-width="2" opacity="0.45"/>
    <path d="M27 31h11" stroke="#6f89b3" stroke-width="2" opacity="0.7"/>
  </g>

  <!-- lustro do vidro -->
  <path d="M12 11h40v11L12 33z" fill="url(#lustro)"/>

  <!-- base/teclado em perspectiva -->
  <path d="M4 42h56l3.2 6.6c.5 1.1-.3 2.4-1.6 2.4H2.4c-1.3 0-2.1-1.3-1.6-2.4z" fill="url(#base)"/>
  <path d="M25 45.4h14c.7 0 1.2.5 1.2 1.1s-.5 1.1-1.2 1.1H25c-.7 0-1.2-.5-1.2-1.1s.5-1.1 1.2-1.1z" fill="#5d6875" opacity="0.55"/>
  <path d="M4 42h56l1 2H3z" fill="#ffffff" opacity="0.35"/>
</svg>
`.trim();

export function programadorDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(PROGRAMADOR_SVG).toString('base64')}`;
}
