# Termômetro da Praça T3 (sub-fatia 1) — mediana + faixa (design)

> Fatia 10. Trocar a média simples do `/termometro` por **mediana + faixa (min–max)**,
> para que um preço absurdo (troll ou erro de digitação) deixe de distorcer o número
> que o produtor vê. Primeira das três sub-fatias do T3.

## Objetivo

Hoje `/termometro` mostra a **média** dos reportes aprovados dos últimos 7 dias. Média
é sensível a um único valor extremo: um reporte de R$ 900/@ no boi puxa a conta mesmo
com dez reportes em torno de R$ 320. Esta fatia troca a média pela **mediana** (o valor
do meio, imune a 1–2 extremos) e exibe a **faixa** (menor–maior valor reportado), que
mostra honestamente a dispersão da praça sem escondê-la.

A plausibilidade já é filtrada na entrada (faixas do `PRODUTOS` no reporte), então a
mediana sozinha basta para a robustez — **sem corte estatístico adicional** (IQR/desvio),
que com poucos reportes por praça descartaria dado legítimo.

## Decisões de design

- **Mediana**, não média aparada nem corte por IQR (escolhido no brainstorming): mais
  simples de explicar ao produtor e robusto de verdade com baixo volume.
- **Faixa = min–max dos valores reportados** (todos já dentro da faixa plausível). Não é
  desvio-padrão nem intervalo de confiança — é o menor e o maior preço que a praça
  reportou, direto.
- **Etiqueta "valor típico"** para o número grande (o produtor não precisa do termo
  "mediana"; deixa claro que não é uma média puxável).
- **Escopo mínimo:** só lógica pura + exibição. Sem banco, dependências, PII ou rotas.

## Arquitetura

Muda três arquivos existentes; nenhum novo.

```
lib/termometro.ts            # resumirReportes: mediana no lugar de média + faixa
components/CardTermometro.tsx # exibe "valor típico" (mediana) + linha de faixa
app/termometro/page.tsx      # passa mediana/faixa (só o tipo muda; a query é a mesma)
```

### `lib/termometro.ts`

Novo helper puro:

```ts
// Mediana de uma lista NÃO vazia, arredondada a 2 casas (par: média dos dois centrais).
export function mediana(valores: number[]): number
```

`ResumoProduto` passa a ser:

```ts
export type ResumoProduto = {
  produto: ProdutoTermometro;
  rotulo: string;
  unidade: string;
  mediana: number;                    // era: media
  faixa: { min: number; max: number };// novo
  contagem: number;
  municipios: { municipio: string; mediana: number; contagem: number }[]; // era: media
};
```

`resumirReportes` (mesma assinatura de entrada) passa a:
- calcular `mediana` do produto (todos os municípios juntos) via `mediana(valores)`;
- calcular `faixa` = `{ min: Math.min(...valores), max: Math.max(...valores) }`;
- por município, calcular `mediana` (não a faixa) + `contagem`.

A ordem, o filtro (produto sem reportes é omitido) e a assinatura pública de
`resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[]` **não mudam**.

### `components/CardTermometro.tsx`

- O número grande passa a ser `resumo.mediana` (mesma formatação `Intl.NumberFormat`
  pt-BR, `font-display tabular-nums`).
- Etiqueta discreta **"valor típico"** próxima ao número (mesmo tom das etiquetas atuais,
  ex.: `text-[11px] uppercase tracking` em `text-tinta/50`).
- Nova linha **"faixa: R$ {min}–{max}"** exibida **apenas quando** `contagem >= 2` **e**
  `faixa.min !== faixa.max` (com 1 reporte ou todos iguais, a faixa é degenerada e some).
- A linha **"média CONAB: X"** permanece inalterada (`mediaConab` continua a mesma prop;
  é a média das UFs na fonte CONAB — rótulo correto). O contraste agora é "valor típico
  da praça" × "média CONAB".
- A lista por município passa a usar `m.mediana` no lugar de `m.media`.

### `app/termometro/page.tsx`

Sem mudança de comportamento: a query e o mapa CONAB seguem iguais. Só o consumo do
tipo muda (o componente recebe `resumo` com `mediana`/`faixa` em vez de `media`). O
`CardTermometro` continua recebendo `resumo` e `mediaConab`.

## Casos de borda

- **1 reporte:** `mediana` = o valor; `faixa` = `{v, v}`; a linha de faixa não aparece.
- **2 reportes:** `mediana` = média dos dois; faixa aparece se forem diferentes.
- **Contagem par:** média dos dois valores centrais, arredondada a 2 casas.
- **Todos iguais:** mediana = o valor; faixa não aparece (min == max).
- **Empate / valores repetidos:** ordenação estável, sem tratamento especial.

## Testes (Vitest, padrão do projeto)

`tests/termometro.test.ts` (atualizar os que assertam `media` → `mediana`):
- `mediana`: ímpar (valor central), par (média dos dois centrais), 1 elemento, valores
  repetidos, arredondamento a 2 casas.
- `resumirReportes`: mediana do produto imune a um extremo (ex.: `[300,310,320,330,900]`
  → mediana 320, não a média ~432); `faixa` = min–max; por município usa mediana;
  produto sem reportes omitido (comportamento preservado).

`tests/components/CardTermometro.test.tsx` (atualizar):
- mostra o "valor típico" (mediana) e a etiqueta;
- mostra "faixa: R$ …–…" com 2+ reportes dispersos;
- **não** mostra a faixa com 1 reporte nem quando min == max;
- continua mostrando "média CONAB" quando `mediaConab` é passado;
- lista por município mostra a mediana.

## Fora do escopo (próximas sub-fatias do T3)

Verificação por telefone/WhatsApp (OTP) — provedor pago + PII; reputação por reportador
— depende de identidade estável. Corte estatístico de outliers (IQR) — desnecessário com
o volume atual. Nada disto entra nesta fatia.

## Deploy

Sem migração, sem env nova. Suíte + build + lint, e2e local rápido (screenshot do
`/termometro` com a mediana e a faixa), push com aprovação, verificação em produção.
