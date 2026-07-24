// Previsão da localização aproximada do usuário (Vercel geo + Open-Meteo), para
// o card "sua região" no topo da página de chuva. Fallback: Vale do Araguaia.
export const dynamic = 'force-dynamic';

const PADRAO = { cidade: 'Vale do Araguaia', uf: '', lat: -15.89, lon: -52.26 };
const URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * O header de geo vem percent-encoded ('S%C3%A3o Paulo'). Se vier malformado, o
 * decodeURIComponent lança URIError — e a rota inteira virava 500 por causa de um
 * header. A fatia 20 corrigiu isto em /api/geo e /api/visita; esta rota ficou de
 * fora e repetia o defeito. Header quebrado agora só perde o nome da cidade.
 */
function decodificarCidade(bruto: string | null): string {
  if (!bruto) return PADRAO.cidade;
  try {
    return decodeURIComponent(bruto);
  } catch {
    return bruto;
  }
}

/** Coordenada de header só vale se for número dentro do planeta. */
function coordenada(bruto: string | null, padrao: number, limite: number): number {
  if (!bruto) return padrao;
  const n = Number(bruto);
  return Number.isFinite(n) && Math.abs(n) <= limite ? n : padrao;
}

export async function GET(req: Request): Promise<Response> {
  const h = req.headers;
  const cidade = decodificarCidade(h.get('x-vercel-ip-city'));
  const uf = h.get('x-vercel-ip-country-region') || PADRAO.uf;
  // Sem a checagem, um header não-numérico virava `latitude=NaN` na URL da
  // Open-Meteo: uma ida à rede garantidamente perdida a cada visita.
  const lat = coordenada(h.get('x-vercel-ip-latitude'), PADRAO.lat, 90);
  const lon = coordenada(h.get('x-vercel-ip-longitude'), PADRAO.lon, 180);

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
