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

export type ValidacaoFornecedor =
  | { tipo: 'honeypot' }
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; fornecedor: Fornecedor };

// Tira não-dígitos; prepende '55' (DDI Brasil) quando vem só DDD+número (10–11 dígitos).
export function normalizarWhatsapp(texto: string): string {
  const digitos = texto.replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

export function validarFornecedor(body: unknown): ValidacaoFornecedor {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.contato === 'string' && b.contato.trim() !== '') {
    return { tipo: 'honeypot' };
  }
  const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
  if (nome.length < 2 || nome.length > 60) {
    return { tipo: 'invalido', erro: 'Informe o nome do fornecedor.' };
  }
  const categoria = b.categoria;
  if (typeof categoria !== 'string' || !CATEGORIAS.some((c) => c.id === categoria)) {
    return { tipo: 'invalido', erro: 'Escolha uma categoria da lista.' };
  }
  const oQueVende = typeof b.oQueVende === 'string' ? b.oQueVende.trim() : '';
  if (oQueVende.length < 2 || oQueVende.length > 120) {
    return { tipo: 'invalido', erro: 'Descreva o que o fornecedor vende.' };
  }
  const municipio = typeof b.municipio === 'string' ? b.municipio.trim() : '';
  if (municipio.length < 2 || municipio.length > 60) {
    return { tipo: 'invalido', erro: 'Informe o município.' };
  }
  const whatsapp = normalizarWhatsapp(typeof b.whatsapp === 'string' ? b.whatsapp : '');
  if (!/^\d{12,13}$/.test(whatsapp)) {
    return { tipo: 'invalido', erro: 'WhatsApp inválido — use DDD + número.' };
  }
  return {
    tipo: 'valido',
    fornecedor: { nome, categoria: categoria as CategoriaFornecedor, oQueVende, municipio, whatsapp },
  };
}

export type DecisaoFornecedor = 'aprovado' | 'rejeitado' | 'removido';
export type ValidacaoDecisaoFornecedor =
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; id: string; decisao: DecisaoFornecedor };

// UUID local (não importar de moderacao.ts, que puxa node:crypto para o bundle client).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarDecisaoFornecedor(body: unknown): ValidacaoDecisaoFornecedor {
  if (typeof body !== 'object' || body === null) return { tipo: 'invalido', erro: 'Envio inválido.' };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { tipo: 'invalido', erro: 'Fornecedor inválido.' };
  if (b.decisao !== 'aprovado' && b.decisao !== 'rejeitado' && b.decisao !== 'removido') {
    return { tipo: 'invalido', erro: 'Decisão inválida.' };
  }
  return { tipo: 'valido', id: b.id, decisao: b.decisao };
}

// View-model da moderação (client-safe — sem PII além do contato comercial público).
export type FornecedorModeravel = {
  id: string;
  nome: string;
  categoriaRotulo: string;
  oQueVende: string;
  municipio: string;
  whatsapp: string;
};
