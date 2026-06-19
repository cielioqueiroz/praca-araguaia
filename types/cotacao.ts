export type Cotacao = {
  tipo: string;
  valor: number;
  unidade: string;
  fonte: string;
  dataReferencia: string; // ISO 8601
};

export type CotacaoSalva = Cotacao & { variacaoPct: number | null };

export interface CotacaoRepo {
  /** Último valor gravado para o tipo, ou null se ainda não há histórico. */
  ultimoValor(tipo: string): Promise<number | null>;
  /** Faz upsert em cotacoes e insert em cotacoes_historico. */
  salvar(cotacao: Cotacao, variacaoPct: number | null): Promise<void>;
}
