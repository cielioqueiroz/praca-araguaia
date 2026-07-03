export type DiaPrevisao = {
  data: string; // yyyy-mm-dd
  chuvaMm: number;
  probMax: number | null; // pode faltar em dias distantes
  tempMin: number;
  tempMax: number;
};

export type PrevisaoMunicipio = { municipio: string; uf: string; dias: DiaPrevisao[] };

// Municípios da região do Araguaia (coordenadas do geocoding da Open-Meteo).
export const MUNICIPIOS = [
  { nome: 'Redenção', uf: 'PA', lat: -8.02861, lon: -50.03139 },
  { nome: 'Santana do Araguaia', uf: 'PA', lat: -9.335, lon: -50.35 },
  { nome: 'Vila Rica', uf: 'MT', lat: -10.01167, lon: -51.11639 },
  { nome: 'Confresa', uf: 'MT', lat: -10.64389, lon: -51.56889 },
  { nome: 'São Félix do Araguaia', uf: 'MT', lat: -11.61722, lon: -50.66944 },
] as const;

type RespostaLocal = {
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
};

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

// Uma chamada só para todos os municípios; a resposta vem na ordem do request.
export async function buscarPrevisao(fetchImpl: typeof fetch = fetch): Promise<PrevisaoMunicipio[]> {
  const url =
    `${URL_BASE}?latitude=${MUNICIPIOS.map((m) => m.lat).join(',')}` +
    `&longitude=${MUNICIPIOS.map((m) => m.lon).join(',')}` +
    '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
    '&timezone=America%2FAraguaina&forecast_days=7';

  // revalidate: o Next reusa a resposta por 1h entre renders da página.
  const res = await fetchImpl(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo respondeu ${res.status}`);

  const body = (await res.json()) as RespostaLocal[];
  if (!Array.isArray(body) || body.length !== MUNICIPIOS.length) {
    throw new Error('Resposta da Open-Meteo inválida: quantidade de localidades não confere');
  }

  return body.map((local, i) => {
    const d = local?.daily;
    if (!d?.time || !d.precipitation_sum || !d.temperature_2m_max || !d.temperature_2m_min) {
      throw new Error(`Resposta da Open-Meteo inválida para ${MUNICIPIOS[i].nome}: daily ausente`);
    }
    const dias = d.time.map((data, j) => ({
      data,
      chuvaMm: Number(d.precipitation_sum?.[j] ?? 0),
      probMax: d.precipitation_probability_max?.[j] ?? null,
      tempMin: Number(d.temperature_2m_min?.[j]),
      tempMax: Number(d.temperature_2m_max?.[j]),
    }));
    return { municipio: MUNICIPIOS[i].nome, uf: MUNICIPIOS[i].uf, dias };
  });
}
