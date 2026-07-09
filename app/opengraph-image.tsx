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
          backgroundColor: '#3f4a24',
          padding: 80,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#586a34" />
          <path d="M24 12 C16 12 12 17 12 24 C12 31 16 36 24 36 C29 36 32 33.5 33.5 30" fill="none" stroke="#f1ebde" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M24 19 L24 29 M24 24 L33 24" fill="none" stroke="#d9a85a" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 90, fontWeight: 600, color: '#f6efd8', letterSpacing: -1 }}>
          Praça Araguaia
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: '#d9cdb2', textAlign: 'center' }}>
          Cotações do agro para o produtor do Araguaia
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 24, color: '#b4863b', letterSpacing: 2, textTransform: 'uppercase' }}>
          cotações · boletim · chuva · termômetro · calculadora
        </div>
      </div>
    ),
    { ...size },
  );
}
