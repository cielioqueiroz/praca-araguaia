import { ordenarPorPraca, ordenarPorUf, NOME_UF } from '@/lib/praca';
import type { PontoHistorico, PontoLugar } from '@/types/cotacao';

export type SerieLugar = {
  chave: string;
  nome: string;
  origem: string;
  pontos: PontoHistorico[];
};

const PRACA_DE_REFERENCIA: Record<string, string> = {
  MT: 'Norte', TO: 'Norte', GO: 'Goiânia', BA: 'Oeste', MA: 'Oeste',
};

export function seriesPorLugar(
  tipo: string,
  pracas: Array<{ praca: string; uf: string }>,
  ufs: Array<{ uf: string }>,
  historico: PontoLugar[],
): SerieLugar[] {
  if (tipo === 'boi' || tipo === 'vaca') {
    return ordenarPorPraca(pracas).map(({ praca, uf }) => ({
      chave: `praca|${uf}|${praca}`,
      nome: `${praca} · ${uf}`,
      origem: PRACA_DE_REFERENCIA[uf]
        ? `Praça ${PRACA_DE_REFERENCIA[uf]}, ${NOME_UF[uf] ?? uf} · Scot Consultoria, via Notícias Agrícolas`
        : `Praça ${praca}, ${uf} · Scot Consultoria, via Notícias Agrícolas`,
      pontos: historico
        .filter((p) => p.recorte === 'praca' && p.uf === uf && p.praca === praca)
        .map((p) => ({ data: p.data, valor: p.valor })),
    }));
  }
  return ordenarPorUf(ufs).map(({ uf }) => ({
    chave: `uf|${uf}`,
    nome: `${NOME_UF[uf] ?? uf} · ${uf}`,
    origem: `${NOME_UF[uf] ?? uf} · ${tipo === 'soja' || tipo === 'milho' ? 'CONAB' : 'Scot Consultoria, via Notícias Agrícolas'}`,
    pontos: historico
      .filter((p) => p.recorte === 'uf' && p.uf === uf)
      .map((p) => ({ data: p.data, valor: p.valor })),
  }));
}

export function lugarInicial(tipo: string, series: SerieLugar[]): string {
  if (tipo === 'boi' || tipo === 'vaca') {
    return series.find((serie) => serie.chave === 'praca|PA|Redenção')?.chave ?? series[0]?.chave ?? '';
  }
  return series.find((serie) => serie.chave === 'uf|PA')?.chave ?? series[0]?.chave ?? '';
}
