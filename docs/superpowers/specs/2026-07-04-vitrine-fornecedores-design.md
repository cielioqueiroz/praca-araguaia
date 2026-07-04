# Vitrine de Fornecedores — diretório curado (design)

> Fatia 12. Diretório curado de agropecuárias, revendas e prestadores da região do
> Araguaia, com contato por link direto do WhatsApp (`wa.me`). Grátis, sem banco, sem
> provedor pago, sem PII de usuário.

## Objetivo

Dar ao produtor um lugar único para achar quem vende o que ele precisa na praça —
ração, defensivos, veterinário, peças — e falar direto no WhatsApp, com um toque. Os
fornecedores são **curados pelo dono do projeto** (lista no código, versionada), não
cadastrados por terceiros. A fatia entrega a vitrine **completa e vazia**, com um estado
"em breve"; os fornecedores reais entram depois, num commit.

## Decisões de design

- **Lista curada no código** (escolhida no brainstorming), não tabela nem cadastro —
  zero banco, zero custo, publica com um commit. Migra para tabela só quando houver
  volume ou terceiros cadastrando.
- **Organização por categoria com filtro de categoria** (chips). O município aparece em
  cada card; **filtro por município fica de fora** por ora (YAGNI: com poucos
  fornecedores não agrega).
- **Sem dado fictício no ar:** a lista começa vazia e a página mostra "em breve". Nada
  de fornecedor ou telefone inventado.
- **Contato via `wa.me`** com mensagem pronta — grátis, sem API do WhatsApp. O produtor
  é quem envia a mensagem.

## Arquitetura

```
lib/fornecedores.ts               # dados curados + tipos + linkWhatsApp + agruparPorCategoria
components/CardFornecedor.tsx      # card puro de um fornecedor + botão wa.me
components/VitrineFornecedores.tsx # client: chips de categoria + lista agrupada filtrada
app/fornecedores/page.tsx         # página (estática) que renderiza a vitrine
components/Header.tsx              # + item "Fornecedores" no menu
```

Sem banco, sem rotas de API, sem dependências novas.

### `lib/fornecedores.ts` (lógica pura + dados)

```ts
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
  oQueVende: string;   // linha curta: "Ração, sal mineral e suplementos"
  municipio: string;
  whatsapp: string;    // só dígitos com DDI, ex.: "5594999998888"
};

// Curada pelo dono. Vazia até os primeiros fornecedores reais entrarem.
export const FORNECEDORES: Fornecedor[] = [];

export const MENSAGEM_PADRAO = 'Olá! Vi seu contato na Praça Araguaia.';

// Monta o link wa.me com a mensagem pré-preenchida (o produtor é quem envia).
export function linkWhatsApp(whatsapp: string, mensagem: string = MENSAGEM_PADRAO): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

export type GrupoFornecedores = { categoria: CategoriaFornecedor; rotulo: string; fornecedores: Fornecedor[] };

// Agrupa na ordem de CATEGORIAS, omitindo categorias sem fornecedor. Filtro opcional por
// categoria (null/undefined = todas).
export function agruparPorCategoria(
  fornecedores: Fornecedor[],
  categoriaFiltro?: CategoriaFornecedor | null,
): GrupoFornecedores[]
```

Regras de `agruparPorCategoria`: itera `CATEGORIAS` na ordem; para cada categoria, os
fornecedores daquela categoria (respeitando `categoriaFiltro` quando informado);
categorias sem fornecedor são omitidas do resultado.

### `components/CardFornecedor.tsx` (apresentação pura)

Recebe `{ fornecedor: Fornecedor }`. Mostra `nome` (destaque), `oQueVende`, `municipio`
(etiqueta discreta) e um botão/anchor **"Chamar no WhatsApp"** apontando para
`linkWhatsApp(fornecedor.whatsapp)`, com `target="_blank"` e `rel="noopener noreferrer"`.
Tokens visuais do projeto (papel/linha/mata/pasto/tinta), botão no verde `pasto`.

### `components/VitrineFornecedores.tsx` (client)

Recebe `{ fornecedores: Fornecedor[] }`. Estado: `categoria: CategoriaFornecedor | null`
(null = todas). Chips no topo: "Todas" + uma por `CATEGORIAS` (estilo do toggle do
gráfico: ativo em `bg-mata text-white`, inativo com borda). Abaixo, `agruparPorCategoria(
fornecedores, categoria)` renderizado como seções (rótulo da categoria + grade de
`CardFornecedor`). Se `fornecedores.length === 0`, mostra o estado vazio
**"Vitrine em breve — estamos reunindo os fornecedores da praça."** (sem chips).

### `app/fornecedores/page.tsx`

Server component **estático** (dados de tempo de compilação — sem `force-dynamic`, sem
Supabase). Cabeçalho ("Fornecedores da praça" + subtítulo curto) e
`<VitrineFornecedores fornecedores={FORNECEDORES} />`. `metadata`: título
"Fornecedores — Praça Araguaia".

### `components/Header.tsx`

Acrescentar `{ href: '/fornecedores', rotulo: 'Fornecedores' }` ao array `LINKS`
(o Header já quebra linha em telas estreitas).

## Casos de borda

- **Lista vazia (estado atual):** página mostra "em breve"; sem chips, sem cards.
- **Categoria sem fornecedor:** omitida da listagem (não vira seção vazia).
- **Filtro numa categoria vazia:** resultado vazio para aquele chip — a área de lista
  mostra "Nenhum fornecedor nesta categoria ainda." (mensagem curta), mantendo os chips.
- **`whatsapp` com espaços/traços:** a lista curada guarda só dígitos com DDI; a
  invariante de teste (abaixo) protege contra formato errado ao adicionar reais.

## Testes (Vitest, padrão do projeto)

`tests/fornecedores.test.ts`:
- `linkWhatsApp`: monta `https://wa.me/<digitos>?text=...` com a mensagem padrão
  codificada; aceita mensagem custom (também codificada).
- `agruparPorCategoria` (com fixture local de fornecedores): agrupa na ordem de
  `CATEGORIAS`; omite categorias vazias; filtro por categoria devolve só aquela.
- **Invariante sobre `FORNECEDORES` reais:** todo item tem `categoria` presente em
  `CATEGORIAS` e `whatsapp` casando `^\d{12,13}$` (DDI 55 + DDD + número). Hoje passa
  vazia; protege quando os reais entrarem.

`tests/components/CardFornecedor.test.tsx`:
- renderiza nome, o que vende, município;
- o botão aponta para o `wa.me` correto, com `target="_blank"` e `rel` de segurança.

`tests/components/VitrineFornecedores.test.tsx` (fixture local):
- lista vazia → estado "em breve";
- com fornecedores → seções por categoria na ordem;
- clicar num chip filtra para aquela categoria;
- chip de categoria sem fornecedor → "Nenhum fornecedor nesta categoria ainda.".

Página verificada por build + e2e (padrão do projeto para páginas).

## Fora do escopo

Cadastro pelo próprio fornecedor + moderação; filtro por município; busca textual;
logotipos/imagens; migração para tabela no Supabase; ordenação por proximidade. Entram
em fatias futuras se a vitrine ganhar volume.

## Deploy

Sem migração, sem env, sem dependência. Suíte + build + lint; e2e local (a página mostra
"em breve" com a lista vazia; com um fixture temporário, os chips e cards funcionam);
push com aprovação; verificação em produção. Depois, os fornecedores reais entram num
commit à parte quando o dono os enviar.
