# Cotações honestas (ouro, cripto, praça) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o ouro (onça → grama), somar Bitcoin e Ethereum, trocar as médias da CONAB pelo preço de cada UF + cidades do Termômetro, destacar a praça do usuário, limpar o painel e refazer o card PNG do Telegram em duas colunas com ilustrações.

**Arquitetura:** As fontes continuam sendo funções puras por arquivo em `lib/fontes/*`, registradas em `registry.ts`. O preço por UF vem do **mesmo** arquivo semanal da CONAB que já baixamos (memoizado), gravado numa tabela nova `cotacoes_uf` (upsert por `(tipo, uf)`), sem histórico próprio — a variação semana a semana é calculada direto do arquivo. O painel e o card do boletim leem `cotacoes` + `cotacoes_uf` + reportes do Termômetro.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Supabase (Postgres + RLS), Vitest, `next/og` (Satori) para o PNG.

## Global Constraints

- **Só ferramentas grátis e sem chave de API** (CoinGecko free, gold-api, Frankfurter, CONAB, Open-Meteo).
- **Nenhuma média na interface.** A palavra "média" sai do painel e do card; boi/soja/milho mostram o preço de cada UF.
- **Falha de uma fonte não derruba as outras** (padrão de `/api/coletar`).
- **Satori não tem glifos exóticos** (lição do ▲/▼): nada de `₿`/`Ξ` no PNG — só texto latino, SVG inline e imagens em data URI.
- **Testes em português**, um arquivo por unidade, `vitest`, mock de `fetch` por rota (padrão de `tests/fontes/ouro.test.ts`).
- Comentários só quando explicam uma restrição que o código não mostra (padrão do repo).

---

### Task 1: Ouro em gramas (fonte + migração de dados)

**Files:**
- Modify: `lib/fontes/ouro.ts`
- Modify: `tests/fontes/ouro.test.ts`
- Create: `supabase/migrations/0005_ouro_em_gramas.sql`
- Modify: `app/page.tsx:16` (`fonteLabel` do ouro → `gold-api · BCB`), `lib/boletim.ts` (sufixo já é `/g`)

**Interfaces:**
- Produces: `buscarOuro(fetchImpl?)` → `Cotacao` com `valor` = R$ por **grama** e `unidade: 'R$/g'`.

- [ ] **Step 1: Ajustar os testes do ouro (falham primeiro)**

Em `tests/fontes/ouro.test.ts`, o primeiro teste passa a esperar a grama:

```ts
it('converte a onça troy de USD para R$ por grama', async () => {
  const f = routedFetch({
    'gold-api': { body: { price: 4000, updatedAt: '2026-06-19T20:00:00Z' } },
    frankfurter: { body: { rates: { BRL: 5.0 } } },
  });
  const c = await buscarOuro(f);
  expect(c.tipo).toBe('ouro');
  expect(c.valor).toBeCloseTo(20000 / 31.1034768, 2); // 643,02
  expect(c.unidade).toBe('R$/g');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fontes/ouro.test.ts`
Expected: FAIL (`expected 20000 to be close to 643.02`).

- [ ] **Step 3: Implementar**

Em `lib/fontes/ouro.ts`:

```ts
// gold-api cota a ONÇA TROY; o mercado brasileiro fala em grama.
const GRAMAS_POR_ONCA_TROY = 31.1034768;
...
const valor = Math.round(((precoUsd * usdBrl) / GRAMAS_POR_ONCA_TROY) * 100) / 100;
return { tipo: 'ouro', valor, unidade: 'R$/g', fonte: 'gold-api', ... };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/fontes/ouro.test.ts` → PASS (4 testes).

- [ ] **Step 5: Migração dos dados já gravados**

`supabase/migrations/0005_ouro_em_gramas.sql`:

```sql
-- O ouro foi gravado na escala da ONÇA TROY (~R$ 21.000) e exibido como /g.
-- Converte o que já existe para grama; sem isso o gráfico daria um degrau falso de -96,8%.
-- Guarda de idempotência: a grama nunca passou de R$ 5.000; a onça nunca ficou abaixo.
update cotacoes
   set valor = round(valor / 31.1034768, 2), unidade = 'R$/g'
 where tipo = 'ouro' and valor > 5000;

update cotacoes_historico
   set valor = round(valor / 31.1034768, 2)
 where tipo = 'ouro' and valor > 5000;
```

Aplicar no Supabase (MCP `apply_migration`, projeto `praca-araguaia`) e conferir:

```sql
select valor, unidade from cotacoes where tipo = 'ouro';
-- esperado: ~678,00 | R$/g
```

- [ ] **Step 6: Commit**

```bash
git add lib/fontes/ouro.ts tests/fontes/ouro.test.ts supabase/migrations/0005_ouro_em_gramas.sql app/page.tsx
git commit -m "fix(ouro): cotar a grama, não a onça troy (÷31,1034768) + migrar histórico"
```

---

### Task 2: Bitcoin e Ethereum (CoinGecko)

**Files:**
- Create: `lib/fontes/cripto.ts`
- Create: `tests/fontes/cripto.test.ts`
- Modify: `lib/fontes/registry.ts`, `lib/tipos-ui.ts`

**Interfaces:**
- Produces: `buscarBitcoin(fetchImpl?)`, `buscarEthereum(fetchImpl?)` → `Cotacao` (`unidade: 'R$'`, `fonte: 'coingecko'`); `buscarHistoricoCripto(moeda: MoedaCripto, fetchImpl?)` → `PontoHistorico[]`; `resetCacheCripto()` para os testes.
- Consumes: `Cotacao`, `PontoHistorico` de `types/cotacao`.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

`tests/fontes/cripto.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarBitcoin, buscarEthereum, buscarHistoricoCripto, resetCacheCripto } from '@/lib/fontes/cripto';

const precoOk = { bitcoin: { brl: 617482.1 }, ethereum: { brl: 8951.01 } };
const fetchDe = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => resetCacheCripto());

describe('cripto', () => {
  it('lê bitcoin e ethereum em reais', async () => {
    const f = fetchDe(precoOk);
    const btc = await buscarBitcoin(f);
    expect(btc.tipo).toBe('bitcoin');
    expect(btc.valor).toBe(617482.1);
    expect(btc.unidade).toBe('R$');
    expect(btc.fonte).toBe('coingecko');
    const eth = await buscarEthereum(f);
    expect(eth.tipo).toBe('ethereum');
    expect(eth.valor).toBe(8951.01);
  });

  it('baixa a cotação uma vez só para as duas moedas', async () => {
    const f = fetchDe(precoOk);
    await buscarBitcoin(f);
    await buscarEthereum(f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('rejeita resposta sem a moeda', async () => {
    await expect(buscarBitcoin(fetchDe({ ethereum: { brl: 1 } }))).rejects.toThrow();
  });

  it('rejeita HTTP não-ok', async () => {
    await expect(buscarBitcoin(fetchDe({}, false))).rejects.toThrow();
  });

  it('converte o market_chart em pontos históricos', async () => {
    const f = fetchDe({ prices: [[1751328000000, 600000], [1751414400000, 610000]] });
    const pts = await buscarHistoricoCripto('bitcoin', f);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ data: new Date(1751328000000).toISOString(), valor: 600000 });
    expect(pts[1].valor).toBe(610000);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fontes/cripto.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lib/fontes/cripto.ts`**

```ts
import type { Cotacao, PontoHistorico } from '@/types/cotacao';

export type MoedaCripto = 'bitcoin' | 'ethereum';

const URL_PRECO = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=brl';
const URL_HISTORICO = (id: MoedaCripto) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=90&interval=daily`;

// O plano grátis da CoinGecko limita requisições por minuto: as duas moedas
// dividem uma única resposta dentro da mesma coleta.
const TTL_MS = 10 * 60 * 1000;
type Precos = Record<MoedaCripto, number>;
let cache: { quando: number; precos: Precos } | null = null;

export function resetCacheCripto(): void {
  cache = null;
}

async function carregar(fetchImpl: typeof fetch): Promise<Precos> {
  if (cache && Date.now() - cache.quando < TTL_MS) return cache.precos;
  const res = await fetchImpl(URL_PRECO);
  if (!res.ok) throw new Error(`CoinGecko respondeu ${res.status}`);
  const body = (await res.json()) as Partial<Record<MoedaCripto, { brl?: number }>>;
  const precos = {} as Precos;
  for (const id of ['bitcoin', 'ethereum'] as const) {
    const v = Number(body?.[id]?.brl);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`CoinGecko sem preço em BRL para ${id}`);
    precos[id] = v;
  }
  cache = { quando: Date.now(), precos };
  return precos;
}

async function buscar(moeda: MoedaCripto, fetchImpl: typeof fetch): Promise<Cotacao> {
  const precos = await carregar(fetchImpl);
  return {
    tipo: moeda,
    valor: precos[moeda],
    unidade: 'R$',
    fonte: 'coingecko',
    dataReferencia: new Date().toISOString(),
  };
}

export const buscarBitcoin = (fetchImpl: typeof fetch = fetch) => buscar('bitcoin', fetchImpl);
export const buscarEthereum = (fetchImpl: typeof fetch = fetch) => buscar('ethereum', fetchImpl);

export async function buscarHistoricoCripto(
  moeda: MoedaCripto,
  fetchImpl: typeof fetch = fetch,
): Promise<PontoHistorico[]> {
  const res = await fetchImpl(URL_HISTORICO(moeda));
  if (!res.ok) throw new Error(`CoinGecko (histórico ${moeda}) respondeu ${res.status}`);
  const body = (await res.json()) as { prices?: [number, number][] };
  const pontos = (body.prices ?? [])
    .filter(([ms, v]) => Number.isFinite(ms) && Number.isFinite(v) && v > 0)
    .map(([ms, v]) => ({ data: new Date(ms).toISOString(), valor: Math.round(v * 100) / 100 }));
  if (pontos.length === 0) throw new Error(`CoinGecko sem histórico de ${moeda}`);
  return pontos;
}
```

- [ ] **Step 4: Registrar a fonte e a apresentação**

`lib/fontes/registry.ts`: importar e somar a `FONTES` (`bitcoin`, `ethereum`) e a `FONTES_HISTORICO`:

```ts
{ tipo: 'bitcoin', fonte: 'coingecko', buscar: () => buscarHistoricoCripto('bitcoin') },
{ tipo: 'ethereum', fonte: 'coingecko', buscar: () => buscarHistoricoCripto('ethereum') },
```

`lib/tipos-ui.ts`: `TITULOS.bitcoin = 'Bitcoin'`, `TITULOS.ethereum = 'Ethereum'`; `ORDEM_PAINEL` passa a `['boi','soja','milho','dolar','euro','ouro','bitcoin','ethereum']` (cripto é diária, então o frescor de 48 h já vale por padrão).

- [ ] **Step 5: Rodar a suíte toda**

Run: `npx vitest run` → PASS (inclusive `tests/fontes/registry.test.ts` e `tests/tipos-ui.test.ts`; ajustar as asserções de contagem/ordem que quebrarem **por causa das duas cotações novas**).

- [ ] **Step 6: Commit**

```bash
git add lib/fontes/cripto.ts tests/fontes/cripto.test.ts lib/fontes/registry.ts lib/tipos-ui.ts tests/
git commit -m "feat(cripto): bitcoin e ethereum em R$ via CoinGecko (atual + 90d)"
```

---

### Task 3: Preço por UF na CONAB (fim da média)

**Files:**
- Modify: `lib/fontes/conab.ts`
- Modify: `tests/fontes/conab.test.ts` (ou criar, se o parser for testado noutro arquivo)
- Create: `supabase/migrations/0006_cotacoes_uf.sql`

**Interfaces:**
- Produces: `buscarPorUf(tipo: TipoCommodity, fetchImpl?)` → `PrecoUf[]`, onde
  ```ts
  export type PrecoUf = {
    tipo: TipoCommodity;
    uf: 'MT' | 'PA' | 'TO' | 'GO';
    valor: number;          // já na unidade de mercado (@ ou sc 60kg)
    unidade: string;        // 'R$/@' | 'R$/sc 60kg'
    variacaoPct: number | null; // contra a semana anterior DAQUELA uf
    dataReferencia: string; // ISO do fim da semana
  };
  ```

- [ ] **Step 1: Teste do parse por UF (falha primeiro)**

Em `tests/fontes/conab.test.ts`, com um texto de arquivo fabricado (duas semanas, duas UFs):

```ts
it('devolve o preço de cada UF, sem média, com a variação contra a semana anterior dela', async () => {
  const arquivo = [
    'cabecalho',
    'BOI;GORDO;1;MT;CENTRO-OESTE;2026;7;29-06-2026 - 03-07-2026;1;PREÇO RECEBIDO P/ PR;20,00',
    'BOI;GORDO;1;MT;CENTRO-OESTE;2026;7;06-07-2026 - 10-07-2026;2;PREÇO RECEBIDO P/ PR;21,00',
    'BOI;GORDO;1;PA;NORTE;2026;7;06-07-2026 - 10-07-2026;2;PREÇO RECEBIDO P/ PR;19,00',
  ].join('\n');
  const f = fetchTexto(arquivo);
  const precos = await buscarPorUf('boi', f);
  expect(precos.map((p) => p.uf)).toEqual(['MT', 'PA']);
  const mt = precos.find((p) => p.uf === 'MT')!;
  expect(mt.valor).toBe(315); // 21,00 × 15
  expect(mt.variacaoPct).toBe(5); // 20 → 21
  expect(mt.unidade).toBe('R$/@');
  const pa = precos.find((p) => p.uf === 'PA')!;
  expect(pa.valor).toBe(285);
  expect(pa.variacaoPct).toBeNull(); // só tem uma semana
});
```

(O helper `fetchTexto` devolve `{ ok: true, arrayBuffer: async () => Buffer.from(texto, 'latin1') }` — o parser decodifica ISO-8859-1.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fontes/conab.test.ts` → FAIL (`buscarPorUf` não existe).

- [ ] **Step 3: Implementar em `lib/fontes/conab.ts`**

O `parse` atual descarta a UF — passa a guardá-la:

```ts
type SemanaUf = { tipo: TipoCommodity; uf: string; fimSemana: string; valorKg: number };
// ...no parse: linhas.push({ tipo, uf: c[3].trim(), fimSemana, valorKg });

const ORDEM_UF = ['MT', 'PA', 'TO', 'GO'] as const;

export async function buscarPorUf(tipo: TipoCommodity, fetchImpl: typeof fetch = fetch): Promise<PrecoUf[]> {
  const linhas = (await carregar(fetchImpl)).filter((l) => l.tipo === tipo);
  const fator = FATOR[tipo];
  return ORDEM_UF.flatMap((uf) => {
    const semanas = linhas
      .filter((l) => l.uf === uf)
      .sort((a, b) => a.fimSemana.localeCompare(b.fimSemana));
    const atual = semanas[semanas.length - 1];
    if (!atual) return [];
    const anterior = semanas[semanas.length - 2];
    const valor = Math.round(atual.valorKg * fator * 100) / 100;
    const variacaoPct = anterior
      ? Math.round(((atual.valorKg - anterior.valorKg) / anterior.valorKg) * 100 * 100) / 100
      : null;
    return [{ tipo, uf, valor, unidade: UNIDADE[tipo], variacaoPct, dataReferencia: atual.fimSemana }];
  });
}
```

As médias existentes (`buscarBoi`/`buscarSoja`/`buscarMilho`, `buscarHistoricoConab`) **continuam** — alimentam o gráfico de `/cotacao/[tipo]` e o histórico já acumulado. O que muda é o que a interface mostra.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/fontes/conab.test.ts` → PASS.

- [ ] **Step 5: Tabela `cotacoes_uf`**

`supabase/migrations/0006_cotacoes_uf.sql`:

```sql
create table if not exists cotacoes_uf (
  id bigint generated always as identity primary key,
  tipo text not null,
  uf text not null,
  valor numeric(12,2) not null,
  unidade text not null,
  variacao_pct numeric(6,2),
  data_referencia timestamptz not null,
  atualizado_em timestamptz not null default now(),
  unique (tipo, uf)
);

alter table cotacoes_uf enable row level security;

create policy "leitura publica de cotacoes_uf"
  on cotacoes_uf for select to anon, authenticated using (true);
```

(Escrita fica só com a service role, que ignora RLS — mesmo desenho de `cotacoes`.)

Aplicar via MCP `apply_migration` e conferir com `list_tables`.

- [ ] **Step 6: Gravar na coleta**

`lib/supabase/repo.ts` ganha `salvarPrecosUf(precos: PrecoUf[])`:

```ts
async salvarPrecosUf(precos) {
  if (precos.length === 0) return;
  const { error } = await client.from('cotacoes_uf').upsert(
    precos.map((p) => ({
      tipo: p.tipo, uf: p.uf, valor: p.valor, unidade: p.unidade,
      variacao_pct: p.variacaoPct, data_referencia: p.dataReferencia,
      atualizado_em: new Date().toISOString(),
    })),
    { onConflict: 'tipo,uf' },
  );
  if (error) throw new Error(error.message);
}
```

`app/api/coletar/route.ts`, depois do laço de `FONTES` (falha isolada, não derruba a coleta):

```ts
for (const tipo of ['boi', 'soja', 'milho'] as const) {
  try {
    await repo.salvarPrecosUf(await buscarPorUf(tipo));
  } catch (e) {
    console.error(`coleta por UF de ${tipo} falhou`, e);
    erros.push({ tipo: `${tipo}_uf`, erro: (e as Error).message });
  }
}
```

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npx vitest run` → PASS.

```bash
git add lib/fontes/conab.ts lib/supabase/repo.ts types/cotacao.ts app/api/coletar/route.ts supabase/migrations/0006_cotacoes_uf.sql tests/
git commit -m "feat(conab): preço por UF (MT/PA/TO/GO) com variação semanal, sem média"
```

---

### Task 4: Sua praça (município mais próximo)

**Files:**
- Create: `lib/praca.ts`
- Create: `tests/praca.test.ts`
- Create: `components/redesign/SuaPraca.tsx`

**Interfaces:**
- Produces: `municipioMaisProximo(lat, lon)` → `{ nome, uf, lat, lon } | null` (null se > 400 km da praça); `ufDaCidade(cidade: string)` → UF ou `null`; componente `<SuaPraca onPraca={(p) => void} />` não é necessário — o painel é servidor, então `SuaPraca` **grava** a praça no `localStorage` e o destaque é aplicado no cliente pelo próprio componente de lista (`data-uf`).
- Consumes: `MUNICIPIOS` de `lib/fontes/chuva.ts` (não duplicar a lista).

- [ ] **Step 1: Teste puro (falha primeiro)**

`tests/praca.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { municipioMaisProximo } from '@/lib/praca';

describe('municipioMaisProximo', () => {
  it('acha Redenção a partir de coordenadas vizinhas', () => {
    expect(municipioMaisProximo(-8.03, -50.03)?.nome).toBe('Redenção');
  });

  it('acha Confresa e devolve a UF', () => {
    const m = municipioMaisProximo(-10.6, -51.5);
    expect(m?.nome).toBe('Confresa');
    expect(m?.uf).toBe('MT');
  });

  it('devolve null para quem está longe da praça (São Paulo)', () => {
    expect(municipioMaisProximo(-23.55, -46.63)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** → `npx vitest run tests/praca.test.ts` → FAIL.

- [ ] **Step 3: Implementar `lib/praca.ts`**

```ts
import { MUNICIPIOS } from '@/lib/fontes/chuva';

export type MunicipioPraca = { nome: string; uf: string; lat: number; lon: number };

const RAIO_TERRA_KM = 6371;
const LIMITE_KM = 400; // fora disso o usuário não está na praça

const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

export function municipioMaisProximo(lat: number, lon: number): MunicipioPraca | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let melhor: { m: MunicipioPraca; d: number } | null = null;
  for (const m of MUNICIPIOS) {
    const d = distanciaKm(lat, lon, m.lat, m.lon);
    if (!melhor || d < melhor.d) melhor = { m: { ...m }, d };
  }
  return melhor && melhor.d <= LIMITE_KM ? melhor.m : null;
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: `components/redesign/SuaPraca.tsx` (client)**

Mesmo padrão de `SuaRegiaoChuva`: tenta `navigator.geolocation` (timeout 8 s) e cai para `/api/geo` (headers da Vercel). Ao resolver, salva `{ cidade, uf }` em `localStorage['praca-loc']`, mostra a tarja "Sua praça: Redenção, PA" e **marca a linha da UF** na lista já renderizada pelo servidor:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { municipioMaisProximo } from '@/lib/praca';

export function SuaPraca() {
  const [praca, setPraca] = useState<{ cidade: string; uf: string } | null>(null);

  useEffect(() => {
    const aplicar = (p: { cidade: string; uf: string }) => {
      setPraca(p);
      localStorage.setItem('praca-loc', JSON.stringify(p));
      document.querySelectorAll<HTMLElement>('[data-uf]').forEach((el) => {
        el.classList.toggle('sua-praca', el.dataset.uf === p.uf);
      });
      document.querySelectorAll<HTMLElement>('[data-cidade]').forEach((el) => {
        el.classList.toggle('sua-cidade', el.dataset.cidade === p.cidade);
      });
    };

    const porIP = () =>
      fetch('/api/geo')
        .then((r) => r.json())
        .then((d) => d?.uf && aplicar({ cidade: d.cidade, uf: d.uf }))
        .catch(() => {});

    if (!navigator.geolocation) return void porIP();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = municipioMaisProximo(pos.coords.latitude, pos.coords.longitude);
        if (m) aplicar({ cidade: m.nome, uf: m.uf });
        else porIP();
      },
      () => porIP(),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  if (!praca) return null;
  return (
    <span className="praca-tag">
      Sua praça: {praca.cidade}
      {praca.uf ? `, ${praca.uf}` : ''}
    </span>
  );
}
```

(O destaque via `data-uf`/`classList` evita transformar o painel inteiro em client component só por causa da localização.)

- [ ] **Step 6: Commit**

```bash
git add lib/praca.ts tests/praca.test.ts components/redesign/SuaPraca.tsx
git commit -m "feat(praca): detectar a praça do usuário (GPS com queda pro IP) e destacar a UF"
```

---

### Task 5: Painel — card-lista da porteira e tabela de mercado

**Files:**
- Create: `components/redesign/CardPorteira.tsx` (card largo com lista por UF + cidades)
- Create: `components/redesign/TabelaMercado.tsx` (lista compacta: dólar, euro, ouro, BTC, ETH)
- Modify: `app/page.tsx` (buscar `cotacoes_uf` + reportes do Termômetro; montar as duas seções; incluir `<SuaPraca />`)
- Modify: `app/globals.css` (classes das duas peças novas + `.sua-praca`/`.sua-cidade`/`.praca-tag`)

**Interfaces:**
- Consumes: `PrecoUf` (Task 3), `resumirReportes`/`ResumoProduto` de `lib/termometro.ts`, `SuaPraca` (Task 4), `FOTO_COMMODITY`/`IconeCommodity` de `iconesCommodity.tsx`.

- [ ] **Step 1: `CardPorteira`**

Props:

```ts
type CardPorteiraProps = {
  tipo: 'boi' | 'soja' | 'milho';
  titulo: string;
  unLabel: string;          // 'R$ por arroba'
  semana: string;           // 'CONAB · semana 06–10/07'
  precos: { uf: string; nome: string; valor: number; variacaoPct: number | null }[];
  cidades: { municipio: string; mediana: number | null; contagem: number }[]; // null = sem reporte
};
```

Render: cabeçalho (ícone + título + etiqueta de unidade + semana), lista de UFs (`<li data-uf="MT">` com nome do estado, valor tabular e variação em musgo/tijolo), depois — **só no boi** — o bloco "Nas cidades da praça · Termômetro", cada linha `<li data-cidade="Redenção">` com o valor típico e `n reportes`, ou "sem reporte ainda" com link para `/termometro/reportar`.

Nomes por UF: `{ MT: 'Mato Grosso', PA: 'Pará', TO: 'Tocantins', GO: 'Goiás' }` (constante no arquivo).

- [ ] **Step 2: `TabelaMercado`**

Props: `itens: { tipo, titulo, valor, casas, variacaoPct, historico: number[] }[]`. Uma linha por ativo: título, valor tabular (`R$`), variação, `Sparkline` pequena (reusa `caminhoSparkline` de `lib/sparkline.ts`). Sem foto, sem selo, sem etiqueta de fonte por linha — a fonte vai no `section-head` ("B3 · BCB · gold-api · CoinGecko · Diário").

- [ ] **Step 3: Ligar no `app/page.tsx`**

- Buscar `cotacoes_uf` (`select tipo, uf, valor, unidade, variacao_pct, data_referencia`).
- Buscar reportes aprovados dos últimos 7 dias (mesma query de `/termometro`) e passar por `resumirReportes` para pegar o resumo do boi por município; municípios sem reporte entram com `mediana: null`.
- Seção **Na porteira**: um `CardPorteira` por commodity (o do boi com as cidades). Cabeçalho da seção sem a palavra "média" → `CONAB · semanal`.
- Seção **Mercado**: um `TabelaMercado` com dólar, euro, ouro, bitcoin, ethereum.
- `<SuaPraca />` no topo do painel.
- Ouro passa a `unLabel: 'R$ por grama'` e `fonteLabel: 'gold-api · BCB'`; cripto `unLabel: 'R$ por unidade'`, `fonteLabel: 'CoinGecko'`, `casas: 2`.

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev` e abrir `http://localhost:3000` — conferir: ouro em ~R$ 678/g, BTC/ETH presentes, boi com as 4 UFs e as cidades, sem a palavra "média", mercado como lista compacta.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/globals.css components/redesign/CardPorteira.tsx components/redesign/TabelaMercado.tsx
git commit -m "feat(painel): porteira em card-lista por UF + cidades, mercado em tabela compacta"
```

---

### Task 6: Card do boletim em duas colunas com ilustrações

**Files:**
- Modify: `lib/boletim.ts` (view-model das duas colunas + lista por UF)
- Modify: `tests/boletim.test.ts`
- Modify: `app/api/boletim/route.tsx` (layout 2 colunas + imagens em data URI)
- Create: `lib/imagens-card.ts` (lê os PNGs do disco e devolve data URI, com cache em módulo)
- Create: `public/assets/cards/bitcoin.png`, `public/assets/cards/ethereum.png`

**Interfaces:**
- Produces:
  ```ts
  export type LinhaBoletim = { tipo: string; titulo: string; valorFmt: string; variacao?: {...}; legenda?: string };
  export type Boletim = {
    dataExtenso: string;
    porteira: { linha: LinhaBoletim; ufs: { nome: string; valorFmt: string; variacao?: {...} }[] }[];
    mercado: LinhaBoletim[];
  };
  export function montarBoletim(linhas: LinhaCotacao[], precosUf: PrecoUf[], agora?: Date): Boletim;
  ```
- Consumes: `PrecoUf` (Task 3), `TITULOS`/`ORDEM_PAINEL` de `tipos-ui`.

- [ ] **Step 1: Atualizar os testes do boletim (falham primeiro)**

Em `tests/boletim.test.ts`: o boletim separa porteira e mercado; o boi traz as UFs; o ouro sai `R$ 678,23 /g`; BTC/ETH aparecem em `mercado`.

- [ ] **Step 2: Rodar e ver falhar** → `npx vitest run tests/boletim.test.ts` → FAIL.

- [ ] **Step 3: Implementar o view-model e ver passar** → PASS.

- [ ] **Step 4: Gerar as artes de BTC e ETH**

Duas PNGs no mesmo estilo dos recortes existentes em `public/assets/cards/` (moeda em vista 3/4, fundo transparente, paleta quente do card). Gerar com a skill `nano-banana` e salvar como `bitcoin.png` e `ethereum.png`. Conferir que abrem e têm fundo transparente.

- [ ] **Step 5: `lib/imagens-card.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// O Satori não busca imagem externa de forma confiável no serverless: embutimos
// os recortes como data URI. Cache em módulo — o arquivo não muda em runtime.
const cache = new Map<string, string | null>();

export function imagemDoAtivo(tipo: string): string | null {
  if (cache.has(tipo)) return cache.get(tipo) ?? null;
  try {
    const bytes = readFileSync(join(process.cwd(), 'public', 'assets', 'cards', `${tipo}.png`));
    const uri = `data:image/png;base64,${bytes.toString('base64')}`;
    cache.set(tipo, uri);
    return uri;
  } catch {
    cache.set(tipo, null); // arte faltando nunca derruba o boletim
    return null;
  }
}
```

- [ ] **Step 6: Layout em duas colunas em `app/api/boletim/route.tsx`**

Mantém 1080×1080, cabeçalho (selo PA + data) e rodapé de fontes (agora `CONAB · B3 · BCB · GOLD-API · COINGECKO`). Miolo vira `display: flex` com duas colunas separadas por um filete vertical:
- Esquerda **NA PORTEIRA**: boi (título + as 4 UFs com valor e variação), soja, milho.
- Direita **MERCADO**: dólar, euro, ouro, bitcoin, ethereum.
- Cada linha começa com `<img src={imagemDoAtivo(tipo)} width={44} height={44} />` quando a arte existe.
- Buscar `cotacoes_uf` na `GET` e passar para `montarBoletim`.

- [ ] **Step 7: Conferir o PNG de verdade**

Run: `npm run dev` e abrir `http://localhost:3000/api/boletim` — a imagem tem de renderizar (não 500), com as duas colunas, as ilustrações, ouro em `/g` e as criptos. Salvar uma cópia e olhar.

- [ ] **Step 8: Commit**

```bash
git add lib/boletim.ts lib/imagens-card.ts app/api/boletim/route.tsx tests/boletim.test.ts public/assets/cards/bitcoin.png public/assets/cards/ethereum.png
git commit -m "feat(boletim): card em duas colunas com ilustração por ativo, preços por UF e cripto"
```

---

### Task 7: Fechamento — suíte, build, deploy e verificação em produção

**Files:**
- Modify: `ESTADO-DO-PROJETO.md` (fatia 15), `README.md` (se citar as 6 cotações)

- [ ] **Step 1: Suíte completa** → `npx vitest run` → tudo verde.
- [ ] **Step 2: Lint e build** → `npm run lint && npm run build` → limpos.
- [ ] **Step 3: Coleta local de verdade** (com `.env.local`):

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/coletar
```

Esperado: `coletadas` com 8 tipos (incluindo `bitcoin` e `ethereum`), `erros: []`, e `cotacoes_uf` populada (conferir no Supabase: 12 linhas — 3 produtos × 4 UFs).

- [ ] **Step 4: Deploy** → `git push origin master` (a Vercel deploya sozinha).
- [ ] **Step 5: Verificar em produção** → abrir `https://agroapp-bay.vercel.app` e `.../api/boletim`: ouro em R$/g, cripto no ar, boi por UF, card novo.
- [ ] **Step 6: Atualizar o ESTADO-DO-PROJETO e commitar.**

---

## Riscos e como reagir

| Risco | Reação |
|---|---|
| CoinGecko dá 429 do IP da Vercel (como a AwesomeAPI dá no dólar) | A coleta já isola a falha. Se acontecer sempre, trocar por Binance `BTCBRL`/`ETHBRL` ou pelo `bitcoin` da AwesomeAPI com fallback — decidir na verificação em produção, não antes. |
| O `data_referencia` do boi por UF difere entre UFs (uma UF atrasa uma semana) | É esperado e correto: cada linha mostra a semana **dela**; o cabeçalho usa a semana mais recente do conjunto. |
| Migração do ouro rodar duas vezes | A guarda `valor > 5000` torna a conversão idempotente. |
| Satori estourar o tamanho com 2 colunas + imagens | Reduzir a arte para 40 px e cortar a legenda das linhas de mercado. |
