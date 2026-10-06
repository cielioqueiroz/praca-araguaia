import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const ARQUIVO_ENV = '.env.local';
const linhas = (await readFile(ARQUIVO_ENV, 'utf8')).split(/\r?\n/);
const valor = (nome) => linhas.find((linha) => linha.startsWith(`${nome}=`))?.slice(nome.length + 1).replace(/^['"]|['"]$/g, '');
const url = valor('DATABASE_URL_UNPOOLED');
const urlPooled = valor('DATABASE_URL');
if (!url || !urlPooled) throw new Error('Conexões Neon ausentes em .env.local');

const banco = new pg.Client({ connectionString: url });
await banco.connect();
try {
  const tabelas = await banco.query("select count(*)::int as total from pg_tables where schemaname = 'public'");
  if (tabelas.rows[0].total !== 0) throw new Error('O banco de destino já tem tabelas públicas; nenhuma alteração foi feita.');

  const senha = randomBytes(32).toString('hex');
  const sql = await readFile('neon/migrations/0001_schema_inicial.sql', 'utf8');
  await banco.query('begin');
  try {
    await banco.query(`create role praca_leitura login password '${senha}'`);
    await banco.query(sql);
    await banco.query('commit');
  } catch (erro) {
    await banco.query('rollback');
    throw erro;
  }

  // As páginas rodam em funções serverless: o papel de leitura também usa o
  // pooler, para não esgotar conexões diretas com instâncias simultâneas.
  const leitura = new URL(urlPooled);
  leitura.username = 'praca_leitura';
  leitura.password = senha;
  const atualizadas = linhas.filter((linha) => !linha.startsWith('DATABASE_URL_READONLY='));
  atualizadas.push(`DATABASE_URL_READONLY=${leitura.toString()}`);
  await writeFile(ARQUIVO_ENV, `${atualizadas.filter((linha, i, todas) => linha !== '' || i !== todas.length - 1).join('\n')}\n`);
  console.log('Neon preparado: 11 tabelas, políticas de leitura e credencial de leitura salvas localmente.');
} finally {
  await banco.end();
}
