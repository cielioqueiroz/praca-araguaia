import { ImageResponse } from 'next/og';
import { marcaDataUri } from '@/lib/marca';

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={marcaDataUri()} width={152} height={152} alt="" />
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
