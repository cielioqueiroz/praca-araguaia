import { MUNICIPIOS } from '@/lib/fontes/chuva';

// A praça do Araguaia: os municípios que a gente cobre e as UFs que a CONAB pesquisa.
export type MunicipioPraca = { nome: string; uf: string; lat: number; lon: number };

export const NOME_UF: Record<string, string> = {
  PA: 'Pará',
  MT: 'Mato Grosso',
  TO: 'Tocantins',
  GO: 'Goiás',
};

const RAIO_TERRA_KM = 6371;
// Fora deste raio o usuário não está na praça — melhor não fingir que está.
const LIMITE_KM = 400;

const rad = (graus: number) => (graus * Math.PI) / 180;

export function distanciaKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

// Roda no navegador: a coordenada do usuário não sai do dispositivo.
export function municipioMaisProximo(lat: number, lon: number): MunicipioPraca | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let melhor: { municipio: MunicipioPraca; distancia: number } | null = null;
  for (const m of MUNICIPIOS) {
    const distancia = distanciaKm(lat, lon, m.lat, m.lon);
    if (!melhor || distancia < melhor.distancia) {
      melhor = { municipio: { nome: m.nome, uf: m.uf, lat: m.lat, lon: m.lon }, distancia };
    }
  }

  return melhor && melhor.distancia <= LIMITE_KM ? melhor.municipio : null;
}

export function ufDaSigla(sigla: string): string | null {
  const uf = sigla.trim().toUpperCase();
  return uf in NOME_UF ? uf : null;
}
