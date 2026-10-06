import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Execute só antes de apontar a produção para o Neon: a origem é a verdade e
// linhas criadas em testes locais no destino são removidas na sincronização final.
// DATE é dia civil; o parser padrão o transformaria em meia-noite do Windows e
// faria a conferência deslocar a data ao converter para UTC.
pg.types.setTypeParser(1082, (valor) => valor);

const linhas = (await readFile('.env.local', 'utf8')).split(/\r?\n/);
const valor = (nome) => linhas.find((linha) => linha.startsWith(`${nome}=`))?.slice(nome.length + 1).replace(/^['"]|['"]$/g, '');
const origemUrl = valor('NEXT_PUBLIC_SUPABASE_URL');
const origemChave = valor('SUPABASE_SERVICE_ROLE_KEY');
const destinoUrl = valor('DATABASE_URL_UNPOOLED');
if (!origemUrl || !origemChave || !destinoUrl) throw new Error('Conexões de origem/destino ausentes em .env.local');

const origem = createClient(origemUrl, origemChave, { auth: { persistSession: false } });
const destino = new pg.Client({ connectionString: destinoUrl });
const tabelas = [
  { nome: 'cotacoes', chave: ['id'] },
  { nome: 'cotacoes_historico', chave: ['id'] },
  { nome: 'cotacoes_praca', chave: ['id'], identidade: true },
  { nome: 'cotacoes_uf', chave: ['id'], identidade: true },
  { nome: 'reportes', chave: ['id'] },
  { nome: 'fornecedores', chave: ['id'] },
  { nome: 'assinantes_telegram', chave: ['chat_id'] },
  { nome: 'visitas', chave: ['dia', 'cidade', 'uf'] },
  { nome: 'tentativas_login', chave: ['id'] },
  { nome: 'alertas_enviados', chave: ['tipo', 'data_referencia'] },
  { nome: 'envios_boletim', chave: ['dia', 'sessao'] },
];

function identificador(nome) {
  if (!/^[a-z_]+$/.test(nome)) throw new Error(`Identificador inesperado: ${nome}`);
  return `"${nome}"`;
}

async function buscarTudo(tabela) {
  const dados = [];
  for (let inicio = 0; ; inicio += 500) {
    let consulta = origem.from(tabela.nome).select('*').range(inicio, inicio + 499);
    for (const coluna of tabela.chave) consulta = consulta.order(coluna, { ascending: true });
    const { data, error } = await consulta;
    if (error) throw new Error(`Falha ao ler ${tabela.nome}: ${error.message}`);
    dados.push(...(data ?? []));
    if ((data ?? []).length < 500) return dados;
  }
}

async function inserirLote(tabela, lote) {
  if (lote.length === 0) return;
  const colunas = Object.keys(lote[0]);
  const parametros = lote.flatMap((linha) => colunas.map((coluna) => linha[coluna]));
  const valores = lote.map((_, indice) => `(${colunas.map((__, posicao) => `$${indice * colunas.length + posicao + 1}`).join(', ')})`).join(', ');
  const atualizaveis = colunas.filter((coluna) => !tabela.chave.includes(coluna));
  const conflito = atualizaveis.length
    ? `do update set ${atualizaveis.map((coluna) => `${identificador(coluna)} = excluded.${identificador(coluna)}`).join(', ')}`
    : 'do nothing';
  const sql = `insert into ${identificador(tabela.nome)} (${colunas.map(identificador).join(', ')}) ${tabela.identidade ? 'overriding system value' : ''} values ${valores} on conflict (${tabela.chave.map(identificador).join(', ')}) ${conflito}`;
  await destino.query(sql, parametros);
}

const COLUNAS_TEMPO = new Set([
  'data_referencia', 'atualizado_em', 'created_at', 'criado_em',
  'variou_em', 'enviado_em', 'iniciado_em', 'concluido_em',
]);
const COLUNAS_NUMERICAS = new Set([
  'valor', 'valor_prazo', 'variacao_pct', 'acessos', 'enviados', 'removidos', 'falhas', 'chat_id',
]);

function linhaNormalizada(tabela, linha) {
  return Object.fromEntries(Object.keys(linha).sort().map((coluna) => {
    const valor = linha[coluna];
    if (valor === null) return [coluna, null];
    if (coluna === 'dia') return [coluna, new Date(valor).toISOString().slice(0, 10)];
    if (COLUNAS_TEMPO.has(coluna)) return [coluna, new Date(valor).toISOString()];
    if (COLUNAS_NUMERICAS.has(coluna) || (coluna === 'id' && tabela.identidade)) return [coluna, Number(valor)];
    return [coluna, valor];
  }));
}

async function conferirDados(tabela, origemDados) {
  const { rows: destinoDados } = await destino.query(`select * from ${identificador(tabela.nome)}`);
  const ordenar = (dados) => dados.map((linha) => JSON.stringify(linhaNormalizada(tabela, linha))).sort();
  const esperados = ordenar(origemDados);
  const obtidos = ordenar(destinoDados);
  if (esperados.length !== obtidos.length || esperados.some((linha, indice) => linha !== obtidos[indice])) {
    const indice = esperados.findIndex((linha, posicao) => linha !== obtidos[posicao]);
    const a = JSON.parse(esperados[indice] ?? '{}');
    const b = JSON.parse(obtidos[indice] ?? '{}');
    const colunas = [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((coluna) => JSON.stringify(a[coluna]) !== JSON.stringify(b[coluna]));
    throw new Error(`Conteúdo diferente em ${tabela.nome} (${colunas.join(', ')}); corte de produção recusado`);
  }
}

async function removerAusentes(tabela, origemDados) {
  const chave = (linha) => JSON.stringify(tabela.chave.map((coluna) => {
    const valor = linha[coluna];
    return coluna === 'dia' || (tabela.nome === 'alertas_enviados' && coluna === 'data_referencia')
      ? new Date(valor).toISOString().slice(0, 10)
      : String(valor);
  }));
  const presentes = new Set(origemDados.map(chave));
  const { rows: destinoDados } = await destino.query(
    `select ${tabela.chave.map(identificador).join(', ')} from ${identificador(tabela.nome)}`,
  );
  for (const linha of destinoDados) {
    if (presentes.has(chave(linha))) continue;
    const filtro = tabela.chave.map((coluna, indice) => `${identificador(coluna)} = $${indice + 1}`).join(' and ');
    await destino.query(
      `delete from ${identificador(tabela.nome)} where ${filtro}`,
      tabela.chave.map((coluna) => linha[coluna]),
    );
  }
}

await destino.connect();
try {
  for (const tabela of tabelas) {
    const dados = await buscarTudo(tabela);
    await destino.query('begin');
    try {
      for (let i = 0; i < dados.length; i += 50) await inserirLote(tabela, dados.slice(i, i + 50));
      await removerAusentes(tabela, dados);
      if (tabela.identidade && dados.length > 0) {
        await destino.query(`select setval(pg_get_serial_sequence($1, 'id'), (select max(id) from ${identificador(tabela.nome)}), true)`, [tabela.nome]);
      }
      const resultado = await destino.query(`select count(*)::int as total from ${identificador(tabela.nome)}`);
      if (resultado.rows[0].total !== dados.length) {
        throw new Error(`Contagem diferente em ${tabela.nome}: origem ${dados.length}, destino ${resultado.rows[0].total}`);
      }
      await conferirDados(tabela, dados);
      await destino.query('commit');
      console.log(`${tabela.nome}: ${dados.length} linhas e conteúdo conferidos`);
    } catch (erro) {
      await destino.query('rollback');
      throw erro;
    }
  }
} finally {
  await destino.end();
}
