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
  media: number;
  contagem: number;
  municipios: { municipio: string; media: number; contagem: number }[];
};

const media2 = (valores: number[]) =>
  Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100;

// Agrega reportes JÁ filtrados (aprovados, últimos 7 dias — responsabilidade da query).
export function resumirReportes(reportes: ReporteAprovado[]): ResumoProduto[] {
  return ORDEM_PRODUTOS.flatMap((produto) => {
    const doProduto = reportes.filter((r) => r.produto === produto);
    if (doProduto.length === 0) return [];
    const municipios = MUNICIPIOS_TERMOMETRO.flatMap((municipio) => {
      const valores = doProduto.filter((r) => r.municipio === municipio).map((r) => r.valor);
      return valores.length === 0 ? [] : [{ municipio, media: media2(valores), contagem: valores.length }];
    });
    return [
      {
        produto,
        rotulo: PRODUTOS[produto].rotulo,
        unidade: PRODUTOS[produto].unidade,
        media: media2(doProduto.map((r) => r.valor)),
        contagem: doProduto.length,
        municipios,
      },
    ];
  });
}
