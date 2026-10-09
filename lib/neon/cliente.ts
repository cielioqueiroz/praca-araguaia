import { attachDatabasePool } from '@vercel/functions';
import pg, { type Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';

// Ponte temporária para as consultas PostgREST existentes. Assim a troca de banco
// não mistura uma reescrita de 76 chamadas com a migração dos dados; a interface
// interna pode ser substituída por repositórios SQL por domínio em fatias menores.
const TABELAS = new Set([
  'cotacoes', 'cotacoes_historico', 'cotacoes_uf', 'cotacoes_praca', 'cotacoes_lugar_historico', 'reportes',
  'fornecedores', 'assinantes_telegram', 'visitas', 'tentativas_login',
  'alertas_enviados', 'envios_boletim',
]);

pg.types.setTypeParser(1184, (valor) => new Date(valor).toISOString());
// DATE é dia civil: converter para meia-noite local mudaria comparações e chaves.
pg.types.setTypeParser(1082, (valor) => valor);
pg.types.setTypeParser(1700, (valor) => Number(valor));
pg.types.setTypeParser(20, (valor) => {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) throw new Error('Inteiro do banco excede a precisão do JavaScript');
  return numero;
});

let poolLeitura: Pool | undefined;
let poolEscrita: Pool | undefined;

export function obterPool(escrita: boolean): Pool {
  const atual = escrita ? poolEscrita : poolLeitura;
  if (atual) return atual;
  const conexao = escrita ? process.env.DATABASE_URL : process.env.DATABASE_URL_READONLY;
  if (!conexao) throw new Error(`Conexão Neon de ${escrita ? 'escrita' : 'leitura'} ausente`);
  const criado = new pg.Pool({ connectionString: conexao, max: 3, idleTimeoutMillis: 10_000 });
  if (process.env.VERCEL) attachDatabasePool(criado);
  if (escrita) poolEscrita = criado;
  else poolLeitura = criado;
  return criado;
}

function identificador(nome: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(nome)) throw new Error('Identificador SQL inválido');
  return `"${nome}"`;
}

function colunasDaSelecao(selecao: string): string {
  if (selecao.trim() === '*') return '*';
  return selecao.split(',').map((coluna) => identificador(coluna.trim())).join(', ');
}

type ErroConsulta = { message: string; code?: string };
type ResultadoConsulta = { data: Record<string, unknown>[] | Record<string, unknown> | null; error: ErroConsulta | null; count: number | null };
type Filtro = { coluna: string; operador: '=' | '>=' | '<' | 'in'; valor: unknown };
type TipoOperacao = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

class Consulta implements PromiseLike<ResultadoConsulta> {
  private operacao: TipoOperacao = 'select';
  private colunas = '*';
  private carga: Record<string, unknown>[] = [];
  private filtros: Filtro[] = [];
  private ordenacao: { coluna: string; ascendente: boolean } | null = null;
  private limite: number | null = null;
  private soContagem = false;
  private retorno = false;
  private unico = false;
  private conflito: string[] = [];
  private ignorarDuplicados = false;

  constructor(private readonly tabela: string, private readonly escrita: boolean) {
    if (!TABELAS.has(tabela)) throw new Error('Tabela não permitida');
  }

  select(colunas: string, opcoes?: { count?: string; head?: boolean }): this {
    this.colunas = colunas;
    if (this.operacao !== 'select') this.retorno = true;
    this.soContagem = opcoes?.count === 'exact' && opcoes?.head === true;
    return this;
  }

  insert(carga: Record<string, unknown> | Record<string, unknown>[]): this {
    this.prepararEscrita('insert', carga);
    return this;
  }

  upsert(carga: Record<string, unknown> | Record<string, unknown>[], opcoes: { onConflict: string; ignoreDuplicates?: boolean }): this {
    this.prepararEscrita('upsert', carga);
    this.conflito = opcoes.onConflict.split(',').map((coluna) => coluna.trim());
    this.ignorarDuplicados = opcoes.ignoreDuplicates ?? false;
    return this;
  }

  update(carga: Record<string, unknown>): this {
    this.prepararEscrita('update', carga);
    return this;
  }

  delete(): this {
    this.prepararEscrita('delete', []);
    return this;
  }

  private prepararEscrita(operacao: TipoOperacao, carga: Record<string, unknown> | Record<string, unknown>[]): void {
    if (!this.escrita) throw new Error('Cliente de leitura não pode escrever');
    this.operacao = operacao;
    this.carga = Array.isArray(carga) ? carga : [carga];
  }

  eq(coluna: string, valor: unknown): this { this.filtros.push({ coluna, operador: '=', valor }); return this; }
  gte(coluna: string, valor: unknown): this { this.filtros.push({ coluna, operador: '>=', valor }); return this; }
  lt(coluna: string, valor: unknown): this { this.filtros.push({ coluna, operador: '<', valor }); return this; }
  in(coluna: string, valor: unknown[]): this { this.filtros.push({ coluna, operador: 'in', valor }); return this; }
  order(coluna: string, opcoes?: { ascending?: boolean }): this {
    this.ordenacao = { coluna, ascendente: opcoes?.ascending ?? true };
    return this;
  }
  limit(quantidade: number): this { this.limite = quantidade; return this; }
  maybeSingle(): this { this.unico = true; return this; }

  private montarFiltros(parametros: unknown[]): string {
    if (this.filtros.length === 0) return '';
    const partes = this.filtros.map((filtro) => {
      const coluna = identificador(filtro.coluna);
      if (filtro.operador === 'in') {
        const itens = filtro.valor as unknown[];
        if (itens.length === 0) return 'false';
        parametros.push(itens);
        return `${coluna} = any($${parametros.length})`;
      }
      parametros.push(filtro.valor);
      return `${coluna} ${filtro.operador} $${parametros.length}`;
    });
    return ` where ${partes.join(' and ')}`;
  }

  private montarSql(): { sql: string; parametros: unknown[] } {
    const tabela = identificador(this.tabela);
    const parametros: unknown[] = [];
    if (this.operacao === 'select') {
      const cols = this.soContagem ? 'count(*)::int as total' : colunasDaSelecao(this.colunas);
      let sql = `select ${cols} from ${tabela}${this.montarFiltros(parametros)}`;
      if (!this.soContagem && this.ordenacao) sql += ` order by ${identificador(this.ordenacao.coluna)} ${this.ordenacao.ascendente ? 'asc' : 'desc'}`;
      if (!this.soContagem && this.limite !== null) {
        parametros.push(this.limite);
        sql += ` limit $${parametros.length}`;
      }
      return { sql, parametros };
    }

    if (this.operacao === 'insert' || this.operacao === 'upsert') {
      if (this.carga.length === 0) throw new Error('Escrita vazia');
      const colunas = Object.keys(this.carga[0]);
      if (colunas.length === 0) throw new Error('Linha vazia');
      const valores = this.carga.map((linha) => {
        if (Object.keys(linha).join('|') !== colunas.join('|')) throw new Error('Colunas divergentes no lote');
        return `(${colunas.map((coluna) => { parametros.push(linha[coluna]); return `$${parametros.length}`; }).join(', ')})`;
      }).join(', ');
      let sql = `insert into ${tabela} (${colunas.map(identificador).join(', ')}) values ${valores}`;
      if (this.operacao === 'upsert') {
        if (this.conflito.length === 0) throw new Error('Conflito não informado');
        const chave = this.conflito.map(identificador).join(', ');
        const atualizaveis = colunas.filter((coluna) => !this.conflito.includes(coluna));
        const acao = this.ignorarDuplicados || atualizaveis.length === 0
          ? 'do nothing'
          : `do update set ${atualizaveis.map((coluna) => `${identificador(coluna)} = excluded.${identificador(coluna)}`).join(', ')}`;
        sql += ` on conflict (${chave}) ${acao}`;
      }
      if (this.retorno) sql += ` returning ${colunasDaSelecao(this.colunas)}`;
      return { sql, parametros };
    }

    if (this.filtros.length === 0) throw new Error('Escrita sem filtro recusada');
    if (this.operacao === 'update') {
      const linha = this.carga[0];
      const atribuicoes = Object.keys(linha).map((coluna) => {
        parametros.push(linha[coluna]);
        return `${identificador(coluna)} = $${parametros.length}`;
      }).join(', ');
      let sql = `update ${tabela} set ${atribuicoes}${this.montarFiltros(parametros)}`;
      if (this.retorno) sql += ` returning ${colunasDaSelecao(this.colunas)}`;
      return { sql, parametros };
    }
    let sql = `delete from ${tabela}${this.montarFiltros(parametros)}`;
    if (this.retorno) sql += ` returning ${colunasDaSelecao(this.colunas)}`;
    return { sql, parametros };
  }

  private async executar(): Promise<ResultadoConsulta> {
    try {
      const { sql, parametros } = this.montarSql();
      const resultado = await obterPool(this.escrita).query<Record<string, unknown>>(sql, parametros);
      if (this.soContagem) return { data: null, error: null, count: Number(resultado.rows[0]?.total ?? 0) };
      const data = this.operacao === 'select' || this.retorno
        ? this.unico ? resultado.rows[0] ?? null : resultado.rows
        : null;
      return { data, error: null, count: null };
    } catch (erro) {
      const codigo = typeof erro === 'object' && erro !== null && 'code' in erro && typeof erro.code === 'string'
        ? erro.code : undefined;
      console.error('Neon: consulta falhou', { tabela: this.tabela, operacao: this.operacao, codigo });
      return { data: null, error: { message: 'Consulta indisponível', code: codigo }, count: null };
    }
  }

  then<TResult1 = ResultadoConsulta, TResult2 = never>(
    resolver?: ((valor: ResultadoConsulta) => TResult1 | PromiseLike<TResult1>) | null,
    rejeitar?: ((motivo: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.executar().then(resolver, rejeitar);
  }
}

class ClienteNeon {
  constructor(private readonly escrita: boolean) {}
  from(tabela: string): Consulta { return new Consulta(tabela, this.escrita); }
  async rpc(nome: string, argumentos: Record<string, unknown>): Promise<ResultadoConsulta> {
    if (!this.escrita || nome !== 'registrar_visita') {
      return { data: null, error: { message: 'Função não permitida' }, count: null };
    }
    try {
      await obterPool(true).query('select registrar_visita($1, $2, $3)', [argumentos.p_dia, argumentos.p_cidade, argumentos.p_uf]);
      return { data: null, error: null, count: null };
    } catch (erro) {
      const codigo = typeof erro === 'object' && erro !== null && 'code' in erro && typeof erro.code === 'string'
        ? erro.code : undefined;
      console.error('Neon: registrar_visita falhou', { codigo });
      return { data: null, error: { message: 'Consulta indisponível', code: codigo }, count: null };
    }
  }
}

export function clienteNeonLeitura(): SupabaseClient {
  return new ClienteNeon(false) as unknown as SupabaseClient;
}

export function clienteNeonEscrita(): SupabaseClient {
  return new ClienteNeon(true) as unknown as SupabaseClient;
}
