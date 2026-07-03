# Commodities CONAB (Boi, Soja, Milho) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar boi gordo, soja e milho ao painel usando o arquivo público semanal da CONAB, com média das UFs MT/PA/TO/GO e histórico via backfill.

**Architecture:** Uma fonte nova (`lib/fontes/conab.ts`) baixa e parseia o `PrecosSemanalUF.txt` (14,5 MB, ISO-8859-1) uma vez por coleta (memoização com TTL), expõe `buscarBoi/Soja/Milho` e `buscarHistoricoConab`, e entra no registry existente. UI ganha módulo compartilhado `lib/tipos-ui.ts` (títulos, ordem, legendas, prazo de "desatualizado" por tipo) e o CardCotacao um prop `legenda`.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Supabase, Vitest + Testing Library. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-07-02-commodities-conab-design.md`

## Global Constraints

- TypeScript **strict**; sem dependências novas; textos de UI e mensagens de erro em **pt-BR**.
- Fontes seguem o padrão existente: `fetchImpl: typeof fetch = fetch` injetável (ver `lib/fontes/euro.ts`).
- Datas sem hora → 00:00 BRT com offset fixo `'-03:00'` → ISO (Brasil sem horário de verão desde 2019).
- Tipos novos: `boi`, `soja`, `milho`; `fonte: 'conab'`; unidades `R$/@` (boi, ×15) e `R$/sc 60kg` (soja/milho, ×60); valores arredondados a 2 casas.
- Testes: Vitest, `describe/it` em pt-BR, no diretório `tests/` espelhando `lib/`.
- Commits pequenos por tarefa, mensagens em português (`feat:`/`test:`/`refactor:`).
- **NUNCA rode `git push` antes da Tarefa 6** — push na `master` = deploy em produção na Vercel.
- Comandos de verificação: `npm test`, `npm run build`, `npm run lint` (é o que a Vercel roda).

## Referência do arquivo CONAB (validado por download em 2026-07-02)

- URL: `https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosSemanalUF.txt`
- Encoding **ISO-8859-1**, CSV separado por `;`, com header na 1ª linha, ~96 mil linhas, **não ordenado por data**.
- Colunas (índices 0–10): `produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg`
- Campos com padding de espaços (sempre `trim`); decimal com vírgula (`22,48`); semana `"dd-mm-aaaa - dd-mm-aaaa"`.
- Linhas alvo: produto/classificação `BOI`/`GORDO`, `SOJA`/`EM GRÃOS`, `MILHO`/`EM GRÃOS`; nível começa com `PREÇO RECEBIDO` (vem truncado: `PREÇO RECEBIDO P/ PR`); UF ∈ {MT, PA, TO, GO}. Ignorar `ATACADO` e `MILHO`/`DE PIPOCA`.

---

### Task 1: Fonte CONAB — parse, cotações e memoização

**Files:**
- Create: `lib/fontes/conab.ts`
- Test: `tests/fontes/conab.test.ts`

**Interfaces:**
- Consumes: `Cotacao`, `PontoHistorico` de `types/cotacao.ts` (já existem).
- Produces: `buscarBoi(fetchImpl?) → Promise<Cotacao>`, `buscarSoja(fetchImpl?)`, `buscarMilho(fetchImpl?)`, `resetCacheConab(): void`, tipo exportado `TipoCommodity = 'boi' | 'soja' | 'milho'`. (O histórico vem na Task 2, no mesmo arquivo.)

- [ ] **Step 1: Write the failing tests**

Criar `tests/fontes/conab.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarBoi, buscarSoja, buscarMilho, resetCacheConab } from '@/lib/fontes/conab';

// Monta uma linha no formato real do arquivo (campos com padding, decimal com vírgula).
const linha = (produto: string, cls: string, uf: string, semana: string, nivel: string, valor: string) =>
  `${produto.padEnd(25)};${cls.padEnd(20)};4193;${uf.padEnd(10)};REGIAO         ;2026;6;${semana}  ;4;${nivel};${valor}`;

const HEADER =
  'produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg';

const NIVEL = 'PREÇO RECEBIDO P/ PR';
const S_ANTIGA = '15-06-2026 - 19-06-2026';
const S_NOVA = '22-06-2026 - 26-06-2026';

const FIXTURE = [
  HEADER,
  linha('BOI', 'GORDO', 'MT', S_ANTIGA, NIVEL, '21,00'),
  linha('BOI', 'GORDO', 'MT', S_NOVA, NIVEL, '22,00'),
  linha('BOI', 'GORDO', 'PA', S_NOVA, NIVEL, '23,00'),
  linha('SOJA', 'EM GRÃOS', 'TO', S_NOVA, NIVEL, '1,80'),
  linha('SOJA', 'EM GRÃOS', 'GO', S_NOVA, NIVEL, '1,90'),
  linha('SOJA', 'EM GRÃOS', 'SP', S_NOVA, NIVEL, '9,99'), // UF fora da região
  linha('SOJA', 'EM GRÃOS', 'MT', S_NOVA, 'ATACADO', '9,99'), // nível errado
  linha('MILHO', 'EM GRÃOS', 'MT', S_ANTIGA, NIVEL, '1,00'), // milho só na semana antiga
  linha('MILHO', 'DE PIPOCA', 'MT', S_NOVA, NIVEL, '9,99'), // classificação errada
  linha('MILHO', 'EM GRÃOS', 'GO', S_NOVA, NIVEL, 'abc'), // valor inválido
  'linha;quebrada', // malformada
].join('\n');

// fetch mock que devolve o texto em bytes ISO-8859-1 (como o servidor da CONAB).
function fetchConab(texto: string = FIXTURE, ok = true, status = 200) {
  const bytes = Buffer.from(texto, 'latin1');
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return vi.fn(async () => ({ ok, status, arrayBuffer: async () => buf })) as unknown as typeof fetch;
}

beforeEach(() => resetCacheConab());

describe('buscarBoi', () => {
  it('faz a média das UFs da semana mais recente e converte para R$/@ (×15)', async () => {
    const c = await buscarBoi(fetchConab());
    expect(c.tipo).toBe('boi');
    expect(c.valor).toBeCloseTo(337.5); // média(22, 23) = 22,50 × 15
    expect(c.unidade).toBe('R$/@');
    expect(c.fonte).toBe('conab');
    expect(c.dataReferencia).toBe(new Date('2026-06-26T00:00:00-03:00').toISOString());
  });
});

describe('buscarSoja', () => {
  it('converte para R$/sc 60kg (×60), ignorando UF de fora e nível ATACADO', async () => {
    const c = await buscarSoja(fetchConab());
    expect(c.valor).toBeCloseTo(111); // média(1,80, 1,90) = 1,85 × 60
    expect(c.unidade).toBe('R$/sc 60kg');
  });
});

describe('buscarMilho', () => {
  it('cai para a semana anterior quando a mais recente não tem valor válido', async () => {
    const c = await buscarMilho(fetchConab());
    expect(c.valor).toBeCloseTo(60); // 1,00 × 60, da semana antiga
    expect(c.dataReferencia).toBe(new Date('2026-06-19T00:00:00-03:00').toISOString());
  });
});

describe('carregamento do arquivo', () => {
  it('rejeita quando o HTTP não é ok', async () => {
    await expect(buscarBoi(fetchConab(FIXTURE, false, 500))).rejects.toThrow(/CONAB/);
  });

  it('rejeita quando não há dado do tipo após o filtro', async () => {
    await expect(buscarBoi(fetchConab(HEADER))).rejects.toThrow(/boi/);
  });

  it('baixa o arquivo uma única vez para vários tipos (memoização)', async () => {
    const f = fetchConab();
    await buscarBoi(f);
    await buscarSoja(f);
    expect(f).toHaveBeenCalledTimes(1);
    resetCacheConab();
    await buscarMilho(f);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/fontes/conab.test.ts`
Expected: FAIL — `Cannot find module '@/lib/fontes/conab'` (ou equivalente).

- [ ] **Step 3: Write the implementation**

Criar `lib/fontes/conab.ts`:

```ts
import type { Cotacao, PontoHistorico } from '@/types/cotacao';

// Brasil sem horário de verão desde 2019: offset fixo -03:00.
const OFFSET_BRT = '-03:00';
const URL_CONAB = 'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosSemanalUF.txt';

// Região do Araguaia: média das UFs na divisa.
const UFS = new Set(['MT', 'PA', 'TO', 'GO']);
const TTL_MS = 10 * 60 * 1000;

export type TipoCommodity = 'boi' | 'soja' | 'milho';

// produto|classificação do arquivo → nosso tipo.
const PRODUTOS: Record<string, TipoCommodity> = {
  'BOI|GORDO': 'boi',
  'SOJA|EM GRÃOS': 'soja',
  'MILHO|EM GRÃOS': 'milho',
};

// O arquivo traz R$/kg; convenção de mercado: boi em arroba, grãos em saca de 60 kg.
const FATOR: Record<TipoCommodity, number> = { boi: 15, soja: 60, milho: 60 };
const UNIDADE: Record<TipoCommodity, string> = { boi: 'R$/@', soja: 'R$/sc 60kg', milho: 'R$/sc 60kg' };

type SemanaUf = { tipo: TipoCommodity; fimSemana: string; valorKg: number };

let cache: { quando: number; linhas: SemanaUf[] } | null = null;

export function resetCacheConab(): void {
  cache = null;
}

// '22-06-2026 - 26-06-2026' → ISO do último dia da semana (00:00 BRT).
function fimDaSemanaIso(intervalo: string): string | null {
  const fim = intervalo.split(' - ')[1]?.trim();
  const m = fim?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00${OFFSET_BRT}`).toISOString();
}

// Parse tolerante: linha malformada ou valor inválido é ignorado, não derruba o arquivo.
function parse(texto: string): SemanaUf[] {
  const linhas: SemanaUf[] = [];
  for (const linha of texto.split('\n')) {
    const c = linha.split(';');
    if (c.length < 11) continue;
    const tipo = PRODUTOS[`${c[0].trim()}|${c[1].trim()}`];
    if (!tipo) continue;
    if (!UFS.has(c[3].trim())) continue;
    // Nível vem truncado no arquivo ('PREÇO RECEBIDO P/ PR'); comparar por prefixo.
    if (!c[9].trim().startsWith('PREÇO RECEBIDO')) continue;
    const fimSemana = fimDaSemanaIso(c[7].trim());
    if (!fimSemana) continue;
    const valorKg = Number(c[10].trim().replace(',', '.'));
    if (!Number.isFinite(valorKg) || valorKg <= 0) continue;
    linhas.push({ tipo, fimSemana, valorKg });
  }
  return linhas;
}

// Baixa e parseia o arquivo 1x por coleta (3 tipos compartilham o download).
async function carregar(fetchImpl: typeof fetch): Promise<SemanaUf[]> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.linhas;
  const res = await fetchImpl(URL_CONAB);
  if (!res.ok) throw new Error(`CONAB respondeu ${res.status}`);
  const texto = new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
  const linhas = parse(texto);
  cache = { quando: Date.now(), linhas };
  return linhas;
}

// Uma média por semana (das UFs disponíveis), já convertida, ordem ascendente.
function mediasSemanais(linhas: SemanaUf[], tipo: TipoCommodity): PontoHistorico[] {
  const porSemana = new Map<string, number[]>();
  for (const l of linhas) {
    if (l.tipo !== tipo) continue;
    const valores = porSemana.get(l.fimSemana) ?? [];
    valores.push(l.valorKg);
    porSemana.set(l.fimSemana, valores);
  }
  const fator = FATOR[tipo];
  return [...porSemana.entries()]
    .map(([data, valores]) => ({
      data,
      valor: Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * fator * 100) / 100,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function buscarCommodity(tipo: TipoCommodity, fetchImpl: typeof fetch): Promise<Cotacao> {
  const pontos = mediasSemanais(await carregar(fetchImpl), tipo);
  const ultimo = pontos[pontos.length - 1];
  if (!ultimo) throw new Error(`CONAB sem dados de ${tipo} para MT/PA/TO/GO`);
  return { tipo, valor: ultimo.valor, unidade: UNIDADE[tipo], fonte: 'conab', dataReferencia: ultimo.data };
}

export const buscarBoi = (fetchImpl: typeof fetch = fetch) => buscarCommodity('boi', fetchImpl);
export const buscarSoja = (fetchImpl: typeof fetch = fetch) => buscarCommodity('soja', fetchImpl);
export const buscarMilho = (fetchImpl: typeof fetch = fetch) => buscarCommodity('milho', fetchImpl);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/fontes/conab.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: todos passam (63 existentes + 7 novos).

- [ ] **Step 6: Commit**

```bash
git add lib/fontes/conab.ts tests/fontes/conab.test.ts
git commit -m "feat: fonte CONAB com boi, soja e milho (media MT/PA/TO/GO)"
```

---

### Task 2: Fonte CONAB — histórico semanal

**Files:**
- Modify: `lib/fontes/conab.ts` (adicionar `buscarHistoricoConab` no fim do arquivo)
- Test: `tests/fontes/conab.test.ts` (adicionar `describe`)

**Interfaces:**
- Consumes: `carregar`, `mediasSemanais` (internos da Task 1), `TipoCommodity`.
- Produces: `buscarHistoricoConab(tipo: TipoCommodity, fetchImpl?: typeof fetch) → Promise<PontoHistorico[]>` (um ponto por semana, média das UFs, convertido, ordem ascendente).

- [ ] **Step 1: Write the failing tests**

Adicionar ao final de `tests/fontes/conab.test.ts` (e incluir `buscarHistoricoConab` no import existente de `@/lib/fontes/conab`):

```ts
describe('buscarHistoricoConab', () => {
  it('devolve um ponto por semana, convertido e em ordem ascendente', async () => {
    const pontos = await buscarHistoricoConab('boi', fetchConab());
    expect(pontos).toEqual([
      { data: new Date('2026-06-19T00:00:00-03:00').toISOString(), valor: 315 }, // 21,00 × 15
      { data: new Date('2026-06-26T00:00:00-03:00').toISOString(), valor: 337.5 }, // média(22, 23) × 15
    ]);
  });

  it('rejeita quando não há nenhuma semana para o tipo', async () => {
    await expect(buscarHistoricoConab('soja', fetchConab(HEADER))).rejects.toThrow(/soja/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/fontes/conab.test.ts`
Expected: FAIL — `buscarHistoricoConab` não exportado.

- [ ] **Step 3: Write the implementation**

Adicionar ao final de `lib/fontes/conab.ts`:

```ts
// Série semanal completa do arquivo (~18 meses), para o backfill idempotente.
export async function buscarHistoricoConab(
  tipo: TipoCommodity,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const pontos = mediasSemanais(await carregar(fetchImpl), tipo);
  if (pontos.length === 0) throw new Error(`CONAB sem histórico de ${tipo}`);
  return pontos;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/fontes/conab.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/fontes/conab.ts tests/fontes/conab.test.ts
git commit -m "feat: historico semanal da CONAB para o backfill"
```

---

### Task 3: Registry — boi, soja e milho na coleta e no backfill

**Files:**
- Modify: `lib/fontes/registry.ts`
- Test: `tests/fontes/registry.test.ts` (criar)

**Interfaces:**
- Consumes: `buscarBoi`, `buscarSoja`, `buscarMilho`, `buscarHistoricoConab` (Tasks 1–2).
- Produces: `FONTES` com chaves `boi`, `soja`, `milho`; `FONTES_HISTORICO` com entradas `{ tipo: 'boi'|'soja'|'milho', fonte: 'conab', buscar }`. As rotas `/api/coletar` e `/api/backfill` já iteram esses registries — nenhuma mudança nelas.

- [ ] **Step 1: Write the failing test**

Criar `tests/fontes/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FONTES, FONTES_HISTORICO } from '@/lib/fontes/registry';

describe('registry de fontes', () => {
  it('tem as 6 cotações na coleta diária', () => {
    expect(Object.keys(FONTES).sort()).toEqual(['boi', 'dolar', 'euro', 'milho', 'ouro', 'soja']);
  });

  it('tem as commodities da CONAB no backfill', () => {
    const conab = FONTES_HISTORICO.filter((f) => f.fonte === 'conab').map((f) => f.tipo);
    expect(conab.sort()).toEqual(['boi', 'milho', 'soja']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fontes/registry.test.ts`
Expected: FAIL — `FONTES` só tem dolar/euro/ouro.

- [ ] **Step 3: Write the implementation**

Substituir o conteúdo de `lib/fontes/registry.ts` por:

```ts
import type { Cotacao, PontoHistorico } from '@/types/cotacao';
import { buscarDolar, buscarHistoricoDolarBcb } from './dolar';
import { buscarEuro, buscarHistoricoEuroFrankfurter } from './euro';
import { buscarOuro } from './ouro';
import { buscarBoi, buscarSoja, buscarMilho, buscarHistoricoConab } from './conab';

// Fontes da coleta diária: tipo -> função que devolve a cotação atual.
export const FONTES: Record<string, () => Promise<Cotacao>> = {
  dolar: () => buscarDolar(),
  euro: () => buscarEuro(),
  ouro: () => buscarOuro(),
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
  { tipo: 'boi', fonte: 'conab', buscar: () => buscarHistoricoConab('boi') },
  { tipo: 'soja', fonte: 'conab', buscar: () => buscarHistoricoConab('soja') },
  { tipo: 'milho', fonte: 'conab', buscar: () => buscarHistoricoConab('milho') },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: todos passam (inclui os 2 novos; as rotas de coleta/backfill continuam verdes porque já são genéricas).

- [ ] **Step 5: Commit**

```bash
git add lib/fontes/registry.ts tests/fontes/registry.test.ts
git commit -m "feat: registra boi, soja e milho na coleta e no backfill"
```

---

### Task 4: `lib/tipos-ui.ts` + prop `legenda` no CardCotacao

**Files:**
- Create: `lib/tipos-ui.ts`
- Modify: `components/CardCotacao.tsx`
- Test: `tests/tipos-ui.test.ts` (criar), `tests/components/CardCotacao.test.tsx` (adicionar 1 teste)

**Interfaces:**
- Consumes: nada de tasks anteriores (módulo puro de UI).
- Produces: `TITULOS: Record<string, string>`, `ORDEM_PAINEL: string[]`, `LEGENDAS: Record<string, string>`, `prazoDesatualizadoMs(tipo: string): number`; `CardCotacaoProps` ganha `legenda?: string`. A Task 5 consome tudo isso nas páginas.

- [ ] **Step 1: Write the failing tests**

Criar `tests/tipos-ui.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TITULOS, ORDEM_PAINEL, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

describe('tipos-ui', () => {
  it('tem título para os 6 tipos', () => {
    expect(TITULOS).toMatchObject({
      boi: 'Boi gordo', soja: 'Soja', milho: 'Milho',
      dolar: 'Dólar', euro: 'Euro', ouro: 'Ouro',
    });
  });

  it('ordena o painel com commodities primeiro', () => {
    expect(ORDEM_PAINEL).toEqual(['boi', 'soja', 'milho', 'dolar', 'euro', 'ouro']);
  });

  it('legenda explicita a média regional só para as commodities', () => {
    expect(LEGENDAS.boi).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.soja).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.milho).toBe('média MT/PA/TO/GO · CONAB');
    expect(LEGENDAS.dolar).toBeUndefined();
  });

  it('prazo de desatualizado: 48h para diárias, 10 dias para semanais', () => {
    expect(prazoDesatualizadoMs('dolar')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('ouro')).toBe(48 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('boi')).toBe(10 * 24 * 60 * 60 * 1000);
    expect(prazoDesatualizadoMs('milho')).toBe(10 * 24 * 60 * 60 * 1000);
  });
});
```

Adicionar ao final do `describe` em `tests/components/CardCotacao.test.tsx`:

```tsx
  it('mostra a legenda quando informada', () => {
    render(
      <CardCotacao titulo="Boi gordo" valor={337.5} unidade="R$/@"
        variacaoPct={null} dataReferencia="2026-06-26T03:00:00.000Z" desatualizado={false}
        legenda="média MT/PA/TO/GO · CONAB" />
    );
    expect(screen.getByText('média MT/PA/TO/GO · CONAB')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tipos-ui.test.ts tests/components/CardCotacao.test.tsx`
Expected: FAIL — módulo `@/lib/tipos-ui` inexistente e prop `legenda` desconhecido.

- [ ] **Step 3: Write the implementation**

Criar `lib/tipos-ui.ts`:

```ts
// Apresentação por tipo de cotação (títulos, ordem do painel, legendas e frescor).

export const TITULOS: Record<string, string> = {
  boi: 'Boi gordo',
  soja: 'Soja',
  milho: 'Milho',
  dolar: 'Dólar',
  euro: 'Euro',
  ouro: 'Ouro',
};

export const ORDEM_PAINEL = ['boi', 'soja', 'milho', 'dolar', 'euro', 'ouro'];

// Média regional calculada por nós — não é indicador oficial; o card deixa isso explícito.
const LEGENDA_CONAB = 'média MT/PA/TO/GO · CONAB';
export const LEGENDAS: Record<string, string> = {
  boi: LEGENDA_CONAB,
  soja: LEGENDA_CONAB,
  milho: LEGENDA_CONAB,
};

const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
const DEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;
const TIPOS_SEMANAIS = new Set(['boi', 'soja', 'milho']);

// Dado semanal (CONAB) só fica "desatualizado" depois de 10 dias.
export function prazoDesatualizadoMs(tipo: string): number {
  return TIPOS_SEMANAIS.has(tipo) ? DEZ_DIAS_MS : DOIS_DIAS_MS;
}
```

Em `components/CardCotacao.tsx`, adicionar `legenda` ao tipo e renderizar sob o título:

```tsx
export type CardCotacaoProps = {
  titulo: string;
  valor: number;
  unidade: string;
  variacaoPct: number | null;
  dataReferencia: string;
  desatualizado: boolean;
  legenda?: string;
};
```

E no JSX, logo após o `<h2>` do título:

```tsx
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{titulo}</h2>
      {legenda && <p className="mt-0.5 text-xs text-neutral-400">{legenda}</p>}
```

(lembrar de incluir `legenda` no destructuring dos props da função).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tipos-ui.test.ts tests/components/CardCotacao.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tipos-ui.ts tests/tipos-ui.test.ts components/CardCotacao.tsx tests/components/CardCotacao.test.tsx
git commit -m "feat: modulo tipos-ui e legenda no CardCotacao"
```

---

### Task 5: Painel e página de detalhe usam `tipos-ui`

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/cotacao/[tipo]/page.tsx`

**Interfaces:**
- Consumes: `TITULOS`, `ORDEM_PAINEL`, `LEGENDAS`, `prazoDesatualizadoMs` (Task 4); prop `legenda` do CardCotacao (Task 4).
- Produces: páginas finais (ninguém consome depois). As páginas não têm teste unitário no projeto — a verificação é `npm run build` + suite completa.

- [ ] **Step 1: Reescrever `app/page.tsx`**

```tsx
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { CardCotacao } from '@/components/CardCotacao';
import { TITULOS, ORDEM_PAINEL, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const posicao = (tipo: string) => {
  const i = ORDEM_PAINEL.indexOf(tipo);
  return i === -1 ? ORDEM_PAINEL.length : i;
};

export default async function Home() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');

  const cotacoes = (data ?? []).slice().sort((a, b) => posicao(a.tipo) - posicao(b.tipo));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-900">agro_app</h1>
      <p className="mt-1 text-sm text-neutral-500">Cotações de referência diárias para o produtor.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {error && <p className="text-red-600">Erro ao carregar cotações.</p>}
        {!error && cotacoes.length === 0 && (
          <p className="text-neutral-500">Ainda sem cotação — rode a coleta (/api/coletar).</p>
        )}
        {cotacoes.map((c) => (
          <Link key={c.tipo} href={`/cotacao/${c.tipo}`} className="block transition hover:opacity-90">
            <CardCotacao
              titulo={TITULOS[c.tipo] ?? c.tipo}
              valor={Number(c.valor)}
              unidade={c.unidade}
              variacaoPct={c.variacao_pct === null ? null : Number(c.variacao_pct)}
              dataReferencia={c.data_referencia}
              desatualizado={Date.now() - new Date(c.data_referencia).getTime() > prazoDesatualizadoMs(c.tipo)}
              legenda={LEGENDAS[c.tipo]}
            />
          </Link>
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Atualizar `app/cotacao/[tipo]/page.tsx`**

Remover as constantes locais `TITULOS` e `DOIS_DIAS_MS`, importar de `@/lib/tipos-ui` e passar legenda/prazo:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { supabaseRepo } from '@/lib/supabase/repo';
import { CardCotacao } from '@/components/CardCotacao';
import { GraficoCotacao } from '@/components/GraficoCotacao';
import { TITULOS, LEGENDAS, prazoDesatualizadoMs } from '@/lib/tipos-ui';

export const dynamic = 'force-dynamic';

const JANELA_DIAS = 90;

export default async function DetalheCotacao({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const supabase = createPublicClient();

  const { data: atual } = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia')
    .eq('tipo', tipo)
    .maybeSingle();

  if (!atual) notFound();

  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const pontos = await supabaseRepo(supabase).historicoRecente(tipo, desde);
  const titulo = TITULOS[tipo] ?? tipo;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{titulo}</h1>

      <div className="mt-6 max-w-sm">
        <CardCotacao
          titulo={titulo}
          valor={Number(atual.valor)}
          unidade={atual.unidade}
          variacaoPct={atual.variacao_pct === null ? null : Number(atual.variacao_pct)}
          dataReferencia={atual.data_referencia}
          desatualizado={Date.now() - new Date(atual.data_referencia).getTime() > prazoDesatualizadoMs(tipo)}
          legenda={LEGENDAS[tipo]}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Tendência</h2>
        {pontos.length === 0 ? (
          <p className="text-neutral-500">Sem histórico ainda.</p>
        ) : (
          <GraficoCotacao pontos={pontos} />
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify — suite, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: testes todos verdes, build sem erro, lint limpo.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx "app/cotacao/[tipo]/page.tsx"
git commit -m "feat: painel com commodities primeiro, legenda regional e frescor por tipo"
```

---

### Task 6: Verificação ponta a ponta + deploy + backfill em produção

**Files:** nenhum (verificação e operação).

**Interfaces:**
- Consumes: tudo das tasks 1–5; `.env.local` com `CRON_SECRET` (e chaves do Supabase) já configurado.
- Produces: app em produção com as 6 cotações e histórico populado.

- [ ] **Step 1: Verificação local completa**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde.

- [ ] **Step 2: Coleta e backfill locais (contra a CONAB real)**

Subir o dev server em background e disparar as rotas com o secret do `.env.local` (PowerShell):

```powershell
# terminal 1 (background): npm run dev
$secret = ((Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=', '').Trim()
curl.exe -s -H "authorization: Bearer $secret" http://localhost:3000/api/coletar
curl.exe -s -H "authorization: Bearer $secret" http://localhost:3000/api/backfill
```

Expected: JSON da coleta com `coletadas` incluindo `boi`, `soja` e `milho` (valores plausíveis: boi ~R$ 300–400/@, soja/milho ~R$ 60–150/sc) e `erros` sem os tipos novos; backfill com `resultados` reportando dezenas de pontos por commodity (~70+ semanas cada). Abrir http://localhost:3000 e conferir os 6 cards (commodities primeiro, com legenda "média MT/PA/TO/GO · CONAB") e `/cotacao/boi` com gráfico. Encerrar o dev server ao final.

- [ ] **Step 3: Deploy**

```bash
git push origin master
```

Expected: Vercel faz o deploy automático (acompanhar em vercel.com se necessário).

- [ ] **Step 4: Coleta e backfill em produção**

```powershell
$secret = ((Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=', '').Trim()
curl.exe -s -H "authorization: Bearer $secret" https://agroapp-bay.vercel.app/api/coletar
curl.exe -s -H "authorization: Bearer $secret" https://agroapp-bay.vercel.app/api/backfill
```

Expected: mesmas respostas do local. Conferir https://agroapp-bay.vercel.app com os 6 cards e as 3 páginas de detalhe com gráfico.

- [ ] **Step 5: Atualizar documentos de retomada**

Atualizar `ESTADO-DO-PROJETO.md`: mover a fatia 4 (commodities CONAB) para "O que já está pronto", atualizar contagem de testes e a lista "O que falta". Commitar:

```bash
git add ESTADO-DO-PROJETO.md
git commit -m "docs: estado do projeto com a fatia 4 (commodities CONAB) concluida"
git push origin master
```
