import { MUNICIPIOS } from '@/lib/fontes/chuva';

export type ProdutoTermometro = 'boi' | 'bezerro' | 'vaca' | 'soja' | 'milho';

// Faixas plausíveis: bloqueiam erro de digitação/troll, não a variação real de mercado.
export const PRODUTOS: Record<ProdutoTermometro, { rotulo: string; unidade: string; min: number; max: number }> = {
  boi: { rotulo: 'Boi gordo', unidade: 'R$/@', min: 150, max: 600 },
  bezerro: { rotulo: 'Bezerro', unidade: 'R$/cabeça', min: 800, max: 6000 },
  vaca: { rotulo: 'Vaca gorda', unidade: 'R$/@', min: 130, max: 550 },
  soja: { rotulo: 'Soja', unidade: 'R$/sc 60kg', min: 40, max: 300 },
  milho: { rotulo: 'Milho', unidade: 'R$/sc 60kg', min: 20, max: 200 },
};

export const ORDEM_PRODUTOS: ProdutoTermometro[] = ['boi', 'bezerro', 'vaca', 'soja', 'milho'];

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

export type ReporteAprovado = { produto: string; municipio: string; valor: number };

export type ResumoProduto = {
  produto: ProdutoTermometro;
  rotulo: string;
  unidade: string;
  mediana: number;
  faixa: { min: number; max: number };
  contagem: number;
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

// Agrega reportes JÁ filtrados (aprovados, últimos 7 dias — responsabilidade da query).
export function resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[] {
  return ORDEM_PRODUTOS.flatMap((produto) => {
    const doProduto = reportes.filter((r) => r.produto === produto);
    if (doProduto.length === 0) return [];
    const valores = doProduto.map((r) => r.valor);
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
        municipios,
      },
    ];
  });
}
