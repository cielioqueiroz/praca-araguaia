// Localização aproximada do usuário pelos headers de geo da Vercel (grátis, sem
// pop-up) + temperatura atual via Open-Meteo. Fallback: Barra do Garças/MT.
export const dynamic = 'force-dynamic';

const PADRAO = { cidade: 'Barra do Garças', uf: 'MT', lat: -15.89, lon: -52.26 };

export async function GET(req: Request): Promise<Response> {
  const h = req.headers;
  const cidadeRaw = h.get('x-vercel-ip-city');
  const uf = h.get('x-vercel-ip-country-region');
  const lat = h.get('x-vercel-ip-latitude');
  const lon = h.get('x-vercel-ip-longitude');

  const cidade = cidadeRaw ? decodeURIComponent(cidadeRaw) : PADRAO.cidade;
  const estado = uf || PADRAO.uf;
  const latN = lat ? Number(lat) : PADRAO.lat;
  const lonN = lon ? Number(lon) : PADRAO.lon;

  const temp = await buscarTemp(latN, lonN);
  return Response.json({ cidade, uf: estado, temp });
}

async function buscarTemp(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`,
      { next: { revalidate: 900 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { current?: { temperature_2m?: number } };
    const t = j?.current?.temperature_2m;
    return typeof t === 'number' ? Math.round(t) : null;
  } catch {
    return null;
  }
}
