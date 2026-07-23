// Uma notícia do mercado, do feed do veículo até o card.

export type Categoria = 'pecuaria' | 'graos' | 'mercado' | 'clima' | 'geral';

/** O que o parser extrai de um <item>/<entry> — ainda sem veículo nem categoria. */
export type ItemBruto = {
  titulo: string;
  link: string;
  publicadoEm: string | null; // ISO; null quando o feed não traz data válida
  resumo: string | null;
  imagem: string | null;
};

/** O item pronto para a tela. */
export type Noticia = ItemBruto & {
  id: string;
  veiculo: string;
  categoria: Categoria;
  /** Fala de fora do Brasil. Cruza as categorias em vez de ser uma delas. */
  internacional: boolean;
};

/**
 * Um feed no registry.
 *
 * Não há mais `nicho`: ser um veículo de agro dispensava o filtro de relevância, e
 * era por essa porta que lifestyle e celebridade entravam na home (ver
 * lib/noticias/classificar.ts). Hoje todo item passa pela mesma régua.
 */
export type Feed = {
  id: string;
  veiculo: string;
  url: string;
};
