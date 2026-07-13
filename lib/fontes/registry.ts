import type { Cotacao, PontoHistorico } from '@/types/cotacao';
import { buscarDolar, buscarHistoricoDolarBcb } from './dolar';
import { buscarEuro, buscarHistoricoEuroFrankfurter } from './euro';
import { buscarOuro } from './ouro';
import { buscarBitcoin, buscarEthereum, buscarHistoricoCripto } from './cripto';
import { buscarBoi, buscarSoja, buscarMilho, buscarHistoricoConab } from './conab';

// Fontes da coleta diária: tipo -> função que devolve a cotação atual.
export const FONTES: Record<string, () => Promise<Cotacao>> = {
  dolar: () => buscarDolar(),
  euro: () => buscarEuro(),
  ouro: () => buscarOuro(),
  bitcoin: () => buscarBitcoin(),
  ethereum: () => buscarEthereum(),
  boi: () => buscarBoi(),
  soja: () => buscarSoja(),
  milho: () => buscarMilho(),
};

// Fontes do backfill de histórico (só as que têm série histórica grátis).
export const FONTES_HISTORICO: Array<{
  tipo: string;
  fonte: string;
  buscar: () => Promise<PontoHistorico[]>;
}> = [
  { tipo: 'dolar', fonte: 'bcb', buscar: () => buscarHistoricoDolarBcb(90) },
  { tipo: 'euro', fonte: 'frankfurter', buscar: () => buscarHistoricoEuroFrankfurter(90) },
  { tipo: 'bitcoin', fonte: 'coingecko', buscar: () => buscarHistoricoCripto('bitcoin') },
  { tipo: 'ethereum', fonte: 'coingecko', buscar: () => buscarHistoricoCripto('ethereum') },
  { tipo: 'boi', fonte: 'conab', buscar: () => buscarHistoricoConab('boi') },
  { tipo: 'soja', fonte: 'conab', buscar: () => buscarHistoricoConab('soja') },
  { tipo: 'milho', fonte: 'conab', buscar: () => buscarHistoricoConab('milho') },
];
