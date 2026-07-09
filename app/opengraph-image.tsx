import { ImageResponse } from 'next/og';

export const alt = 'Praça Araguaia — cotações do agro para o produtor do Araguaia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Card institucional 1200×630 no subconjunto flexbox do Satori (estilos inline;
// todo div com múltiplos filhos-elemento precisa de display flex explícito).
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c3a2b',
          padding: 80,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="7" fill="#15803d" />
          <line x1="16" y1="25.5" x2="16" y2="13" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 17.5c-.7-3.6-3.5-5.6-7.2-5.6-.4 3.9 2.5 6.8 7.2 6.8z" fill="#bbf7d0" />
          <path d="M16 14.2c.7-3.6 3.5-5.6 7.2-5.6.4 3.9-2.5 6.8-7.2 6.8z" fill="#ffffff" />
        </svg>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 88, fontWeight: 700, color: '#ffffff' }}>
          Praça Araguaia
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 36, color: '#bbf7d0', textAlign: 'center' }}>
          Cotações do agro para o produtor do Araguaia
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 26, color: '#8bb39b' }}>
          cotações · boletim · chuva · termômetro · calculadora
        </div>
      </div>
    ),
    { ...size },
  );
}
