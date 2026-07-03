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

export type PontoHistorico = { data: string; valor: number }; // data ISO 8601, ordem asc

export interface HistoricoRepo {
  /** Insere pontos em lote para o tipo/fonte, ignorando duplicados (tipo, data_referencia). */
  salvarHistoricoEmLote(tipo: string, fonte: string, pontos: PontoHistorico[]): Promise<void>;
  /** Pontos com data_referencia >= `desde` (ISO), ordem ascendente. */
  historicoRecente(tipo: string, desde: string): Promise<PontoHistorico[]>;
}
