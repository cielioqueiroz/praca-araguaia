// Previsão da localização aproximada do usuário (Vercel geo + Open-Meteo), para
// o card "sua região" no topo da página de chuva. Fallback: Barra do Garças/MT.
export const dynamic = 'force-dynamic';

const PADRAO = { cidade: 'Barra do Garças', uf: 'MT', lat: -15.89, lon: -52.26 };
const URL = 'https://api.open-meteo.com/v1/forecast';

export async function GET(req: Request): Promise<Response> {
  const h = req.headers;
  const cidadeRaw = h.get('x-vercel-ip-city');
  const cidade = cidadeRaw ? decodeURIComponent(cidadeRaw) : PADRAO.cidade;
  const uf = h.get('x-vercel-ip-country-region') || PADRAO.uf;
  const lat = h.get('x-vercel-ip-latitude') ? Number(h.get('x-vercel-ip-latitude')) : PADRAO.lat;
  const lon = h.get('x-vercel-ip-longitude') ? Number(h.get('x-vercel-ip-longitude')) : PADRAO.lon;

  try {
    const r = await fetch(
      `${URL}?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m' +
        '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=7',
      { next: { revalidate: 1800 } },
    );
    if (!r.ok) return Response.json({ cidade, uf, tempAtual: null, dias: [] });
    const j = (await r.json()) as {
      current?: { temperature_2m?: number };
      daily?: {
        time?: string[];
        precipitation_sum?: (number | null)[];
        precipitation_probability_max?: (number | null)[];
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
      };
    };
    const d = j.daily;
    const dias = (d?.time ?? []).map((data, i) => ({
      data,
      chuvaMm: Number(d?.precipitation_sum?.[i] ?? 0),
      probMax: d?.precipitation_probability_max?.[i] ?? null,
      tempMin: Number(d?.temperature_2m_min?.[i]),
      tempMax: Number(d?.temperature_2m_max?.[i]),
    }));
    const tempAtual = typeof j.current?.temperature_2m === 'number' ? Math.round(j.current.temperature_2m) : null;
    return Response.json({ cidade, uf, tempAtual, dias });
  } catch {
    return Response.json({ cidade, uf, tempAtual: null, dias: [] });
  }
}
