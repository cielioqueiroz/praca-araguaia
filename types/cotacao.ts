export type Cotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  fonte: string;
  dataReferencia: string; // ISO 8601
};

export type CotacaoSalva = Cotacao & { variacaoPct: number | null };

export interface CotacaoRepo {
  /** Último valor gravado para o tipo com data_referencia < antesDe, ou null. */
  ultimoValor(tipo: string, antesDe: string): Promise<number | null>;
  /** Faz upsert em cotacoes e insert em cotacoes_historico. */
  salvar(cotacao: Cotacao, variacaoPct: number | null): Promise<void>;
}

/** Preço de uma UF na semana mais recente dela — o que a praça vê, sem média. */
export type PrecoUf = {
  tipo: string;
  uf: string;
  valor: number; // já na unidade de mercado (@ ou sc 60kg)
  unidade: string;
  variacaoPct: number | null; // contra a semana anterior DAQUELA uf
  dataReferencia: string; // ISO 8601 do fim da semana
};

export interface PrecoUfRepo {
  /** Upsert por (tipo, uf). */
  salvarPrecosUf(precos: PrecoUf[]): Promise<void>;
}

/**
 * Preço de uma PRAÇA — um degrau mais fino que a UF. A Scot pesquisa Marabá,
 * Redenção e Paragominas separadamente, e é assim que a região negocia; a média do
 * Pará não é o preço de ninguém.
 */
export type PrecoPraca = {
  tipo: string;
  uf: string;
  praca: string; // 'Redenção', 'Norte', 'Cuiabá'
  valor: number;
  unidade: string;
  variacaoPct: number | null;
  dataReferencia: string; // ISO 8601
  /** Só o boi tem: o mesmo preço a prazo de 30 dias. */
  valorPrazo?: number;
};

export interface PrecoPracaRepo {
  /** Upsert por (tipo, praca, uf). */
  salvarPrecosPraca(precos: PrecoPraca[]): Promise<void>;
}

export type PontoHistorico = { data: string; valor: number }; // data ISO 8601, ordem asc

export interface HistoricoRepo {
  /** Insere pontos em lote para o tipo/fonte, ignorando duplicados (tipo, data_referencia). */
  salvarHistoricoEmLote(tipo: string, fonte: string, pontos: PontoHistorico[]): Promise<void>;
  /** Pontos com data_referencia >= `desde` (ISO), ordem ascendente. */
  historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]>;
}
