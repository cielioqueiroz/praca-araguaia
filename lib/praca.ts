import { MUNICIPIOS } from '@/lib/fontes/chuva';

// A praça do Araguaia: os municípios que a gente cobre e as UFs que a CONAB pesquisa.
export type MunicipioPraca = { nome: string; uf: string; lat: number; lon: number };

export const NOME_UF: Record<string, string> = {
  PA: 'Pará',
  MT: 'Mato Grosso',
  TO: 'Tocantins',
  GO: 'Goiás',
  // Fora do Araguaia, entram como referência — o dono tem gente acompanhando de lá.
  BA: 'Bahia',
  MA: 'Maranhão',
  PE: 'Pernambuco',
};

// A ordem em que a praça lê os estados. O banco não garante ordem nenhuma: sem isto,
// um card lista PA/MT/TO/GO e o do lado GO/PA/MT/TO, e o olho perde a comparação.
//
// O Araguaia vem primeiro e o resto depois: o site é a praça do Vale, e BA/MA/PE são
// referência. Quem abre o card tem de achar o preço de casa no topo, sem procurar.
export const ORDEM_UF = ['PA', 'MT', 'TO', 'GO', 'BA', 'MA', 'PE'];

/**
 * O Vale do Araguaia propriamente dito.
 *
 * O site mostra BA/MA/PE como referência, mas o BOLETIM não: ele é uma imagem de
 * tamanho fixo, e a porteira inteira com os sete estados passaria de 45 linhas —
 * o card já teve de virar 1080x1350 quando eram 12. Aqui ele recorta o que é casa.
 */
export const UFS_ARAGUAIA = ['PA', 'MT', 'TO', 'GO'];
export const ehDoAraguaia = (uf: string) => UFS_ARAGUAIA.includes(uf);

const posUf = (uf: string) => {
  const i = ORDEM_UF.indexOf(uf);
  return i === -1 ? ORDEM_UF.length : i;
};

export function ordenarPorUf<T extends { uf: string }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => posUf(a.uf) - posUf(b.uf));
}

/**
 * Como ordenarPorUf, mas desempata pelo nome da praça.
 *
 * Ordenar só pela UF não basta quando o estado tem várias praças: o Postgres devolve
 * na ordem que quiser e, dentro do Pará, Marabá e Redenção trocavam de lugar entre um
 * acesso e outro — o mesmo problema que a ordem das UFs já resolvia, repetido um
 * degrau abaixo. Preço que dança de linha o produtor não compara.
 */
export function ordenarPorPraca<T extends { uf: string; praca: string }>(itens: T[]): T[] {
  return [...itens].sort(
    (a, b) => posUf(a.uf) - posUf(b.uf) || a.praca.localeCompare(b.praca, 'pt-BR'),
  );
}

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
