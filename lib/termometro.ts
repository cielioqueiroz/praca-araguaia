import { MUNICIPIOS } from '@/lib/fontes/chuva';

// Os mesmos 6 tipos da porteira: todo preço que o painel publica, o produtor pode
// confrontar com o que está sendo pago na cidade dele.
export type ProdutoTermometro = 'boi' | 'vaca' | 'novilha' | 'bezerro' | 'soja' | 'milho';

/**
 * De quem é a testemunha do preço (ADR 0003).
 *
 * 'produtor' — chegou pelo formulário público, anônimo, de quem negociou.
 * 'praca'    — a Praça Araguaia apurou por telefone e lançou pela moderação.
 *
 * Os dois entram na mesma conta: é tudo preço real da região. Mas nenhuma tela pode
 * mostrar o valor sem dizer de quem ele veio — foi a condição para semear o
 * Termômetro em vez de esperar ele encher sozinho.
 */
export type OrigemReporte = 'produtor' | 'praca';

export const ROTULO_ORIGEM: Record<OrigemReporte, string> = {
  produtor: 'relatado por produtores',
  praca: 'apurado pela Praça',
};

// Faixas plausíveis: bloqueiam erro de digitação/troll, não a variação real de mercado.
//
// NOVILHA É POR CABEÇA, não por arroba (corrigido em 24/07/2026). Ela é REPOSIÇÃO —
// a fêmea nelore de 18 meses da Scot, em R$/cabeça (ver lib/fontes/pecuaria.ts e a
// unidade em tipos-ui.ts). Enquanto esta faixa era 'R$/@, 130–550', o Termômetro
// rejeitava o reporte correto de uma novilha (~R$ 2.971/cab) como "fora da faixa" e
// rotulava a unidade errada no gráfico. A faixa acompanha o bezerro, que é a mesma
// reposição por cabeça.
export const PRODUTOS: Record<ProdutoTermometro, { rotulo: string; unidade: string; min: number; max: number }> = {
  boi: { rotulo: 'Boi gordo', unidade: 'R$/@', min: 150, max: 600 },
  vaca: { rotulo: 'Vaca gorda', unidade: 'R$/@', min: 130, max: 550 },
  novilha: { rotulo: 'Novilha', unidade: 'R$/cabeça', min: 800, max: 6000 },
  bezerro: { rotulo: 'Bezerro', unidade: 'R$/cabeça', min: 800, max: 6000 },
  soja: { rotulo: 'Soja', unidade: 'R$/sc 60kg', min: 40, max: 300 },
  milho: { rotulo: 'Milho', unidade: 'R$/sc 60kg', min: 20, max: 200 },
};

// Mesma ordem da porteira (gado e depois lavoura).
export const ORDEM_PRODUTOS: ProdutoTermometro[] = ['boi', 'vaca', 'novilha', 'bezerro', 'soja', 'milho'];

export const MUNICIPIOS_TERMOMETRO: string[] = MUNICIPIOS.map((m) => m.nome);

// Converte texto pt-BR em número: "1.500" → 1500, "1.500,50" → 1500.5, "320,5" → 320.5, "320.5" → 320.5.
export function normalizarValor(texto: string): number {
  const t = texto.trim().replace(/\s/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
}

export type ReporteValido = { produto: ProdutoTermometro; municipio: string; valor: number };

export type Validacao =
  | { tipo: 'honeypot' }
  | { tipo: 'invalido'; erro: string }
  | { tipo: 'valido'; reporte: ReporteValido };

export function validarReporte(body: unknown): Validacao {
  if (typeof body !== 'object' || body === null) {
    return { tipo: 'invalido', erro: 'Envio inválido.' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.contato === 'string' && b.contato.trim() !== '') {
    return { tipo: 'honeypot' };
  }
  const produto = b.produto as ProdutoTermometro;
  if (typeof produto !== 'string' || !(produto in PRODUTOS)) {
    return { tipo: 'invalido', erro: 'Escolha um produto da lista.' };
  }
  const municipio = b.municipio;
  if (typeof municipio !== 'string' || !MUNICIPIOS_TERMOMETRO.includes(municipio)) {
    return { tipo: 'invalido', erro: 'Escolha um município da lista.' };
  }
  const valor = Number(b.valor);
  const { min, max, unidade } = PRODUTOS[produto];
  if (!Number.isFinite(valor) || valor < min || valor > max) {
    return { tipo: 'invalido', erro: `Valor fora da faixa esperada (${min} a ${max} ${unidade}).` };
  }
  return { tipo: 'valido', reporte: { produto, municipio, valor } };
}

export type ReporteAprovado = {
  produto: string;
  municipio: string;
  valor: number;
  /** Ausente = 'produtor': é o que todo reporte era antes de a coluna existir. */
  origem?: OrigemReporte;
};

export type ContagemPorOrigem = { produtor: number; praca: number };

/**
 * A linha de procedência do card — o que a tela é OBRIGADA a dizer junto do número.
 *
 * Com uma origem só, a frase é a origem. Com as duas, o card mostra quantos vieram de
 * cada lado, porque "2 de 7 apurados por nós" e "7 de 7" não merecem a mesma leitura.
 */
export function procedencia(origens: ContagemPorOrigem): string {
  if (origens.praca === 0) return ROTULO_ORIGEM.produtor;
  if (origens.produtor === 0) return ROTULO_ORIGEM.praca;
  return `${origens.produtor} de produtores · ${origens.praca} ${origens.praca === 1 ? 'apurado' : 'apurados'} pela Praça`;
}

export type ResumoProduto = {
  produto: ProdutoTermometro;
  rotulo: string;
  unidade: string;
  mediana: number;
  faixa: { min: number; max: number };
  contagem: number;
  origens: ContagemPorOrigem;
  /** Já pronta para a tela: ninguém monta esta frase por conta própria. */
  procedencia: string;
  municipios: { municipio: string; mediana: number; contagem: number }[];
};

// Mediana de uma lista NÃO vazia, arredondada a 2 casas (par: média dos dois centrais).
export function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const bruta =
    ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
  return Math.round(bruta * 100) / 100;
}

export type CidadeDoProduto = { municipio: string; uf: string; mediana: number | null; contagem: number };

// As cidades da praça para UM produto: o valor típico (mediana) do que os produtores
// reportaram. Cidade sem reporte NÃO some — fica como convite ("seja o primeiro").
// Usada pelo painel e pelo card do boletim, para os dois contarem a mesma história.
export function cidadesDoProduto(reportes: ReporteAprovado[], produto: string): CidadeDoProduto[] {
  const valores = new Map<string, number[]>();
  for (const r of reportes) {
    if (r.produto !== produto) continue;
    const arr = valores.get(r.municipio) ?? [];
    arr.push(Number(r.valor));
    valores.set(r.municipio, arr);
  }

  return MUNICIPIOS.map((m) => {
    const v = valores.get(m.nome) ?? [];
    return {
      municipio: m.nome,
      uf: m.uf,
      mediana: v.length ? mediana(v) : null,
      contagem: v.length,
    };
  }).sort((a, b) => (b.contagem > 0 ? 1 : 0) - (a.contagem > 0 ? 1 : 0)); // quem tem reporte primeiro
}

/**
 * Quantos reportes de cada origem existem para UM produto.
 *
 * Serve às telas que mostram o Termômetro fora da página dele — o card da porteira
 * em /cotacoes e o card do boletim —, que também não podem publicar o número sem
 * dizer quem o testemunhou.
 */
export function origensDoProduto(reportes: ReporteAprovado[], produto: string): ContagemPorOrigem {
  const doProduto = reportes.filter((r) => r.produto === produto);
  return {
    produtor: doProduto.filter((r) => (r.origem ?? 'produtor') === 'produtor').length,
    praca: doProduto.filter((r) => r.origem === 'praca').length,
  };
}

// Agrega reportes JÁ filtrados (aprovados, últimos 7 dias — responsabilidade da query).
export function resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[] {
  return ORDEM_PRODUTOS.flatMap((produto) => {
    const doProduto = reportes.filter((r) => r.produto === produto);
    if (doProduto.length === 0) return [];
    const valores = doProduto.map((r) => r.valor);
    const origens: ContagemPorOrigem = {
      produtor: doProduto.filter((r) => (r.origem ?? 'produtor') === 'produtor').length,
      praca: doProduto.filter((r) => r.origem === 'praca').length,
    };
    const municipios = MUNICIPIOS_TERMOMETRO.flatMap((municipio) => {
      const doMunicipio = doProduto.filter((r) => r.municipio === municipio).map((r) => r.valor);
      return doMunicipio.length === 0
        ? []
        : [{ municipio, mediana: mediana(doMunicipio), contagem: doMunicipio.length }];
    });
    return [
      {
        produto,
        rotulo: PRODUTOS[produto].rotulo,
        unidade: PRODUTOS[produto].unidade,
        mediana: mediana(valores),
        faixa: { min: Math.min(...valores), max: Math.max(...valores) },
        contagem: doProduto.length,
        origens,
        procedencia: procedencia(origens),
        municipios,
      },
    ];
  });
}
