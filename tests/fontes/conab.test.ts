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
