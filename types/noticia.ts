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
};

/** Um feed no registry. `nicho: true` = veículo só de agro, dispensa filtro de relevância. */
export type Feed = {
  id: string;
  veiculo: string;
  url: string;
  nicho: boolean;
};
