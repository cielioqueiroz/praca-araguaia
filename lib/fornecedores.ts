export type CategoriaFornecedor =
  | 'racao-sal'
  | 'defensivos-sementes'
  | 'veterinario'
  | 'maquinas-pecas'
  | 'assistencia-tecnica';

export const CATEGORIAS: { id: CategoriaFornecedor; rotulo: string }[] = [
  { id: 'racao-sal', rotulo: 'Ração e sal' },
  { id: 'defensivos-sementes', rotulo: 'Defensivos e sementes' },
  { id: 'veterinario', rotulo: 'Veterinário' },
  { id: 'maquinas-pecas', rotulo: 'Máquinas e peças' },
  { id: 'assistencia-tecnica', rotulo: 'Assistência técnica' },
];

export type Fornecedor = {
  nome: string;
  categoria: CategoriaFornecedor;
  oQueVende: string;
  municipio: string;
  whatsapp: string; // só dígitos com DDI, ex.: "5594999998888"
};

// Curada pelo dono. Vazia até os primeiros fornecedores reais entrarem.
export const FORNECEDORES: Fornecedor[] = [];

export const MENSAGEM_PADRAO = 'Olá! Vi seu contato na Praça Araguaia.';

// Monta o link wa.me com a mensagem pré-preenchida (o produtor é quem envia).
export function linkWhatsApp(whatsapp: string, mensagem: string = MENSAGEM_PADRAO): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

export type GrupoFornecedores = {
  categoria: CategoriaFornecedor;
  rotulo: string;
  fornecedores: Fornecedor[];
};

// Agrupa na ordem de CATEGORIAS, omitindo categorias sem fornecedor.
export function agruparPorCategoria(
  fornecedores: Fornecedor[],
  categoriaFiltro?: CategoriaFornecedor | null,
): GrupoFornecedores[] {
  return CATEGORIAS.flatMap(({ id, rotulo }) => {
    if (categoriaFiltro && categoriaFiltro !== id) return [];
    const doGrupo = fornecedores.filter((f) => f.categoria === id);
    return doGrupo.length === 0 ? [] : [{ categoria: id, rotulo, fornecedores: doGrupo }];
  });
}
