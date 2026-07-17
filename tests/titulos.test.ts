import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A marca vem PRIMEIRO na aba: quem tem 8 abas abertas lê os 12 primeiros caracteres
// e precisa achar a praça. O layout monta isso com title.template ('Praça Araguaia —
// %s') e cada página declara só o próprio nome.
//
// A pegadinha: no Next, title.template NÃO vale para o segmento onde é definido. A
// home (app/page.tsx) divide o segmento raiz com o layout, então ela — e só ela —
// precisa escrever o título inteiro. Foi assim que a aba da home foi para produção
// como "Notícias do Mercado", sem a marca.

const RAIZ = join(process.cwd(), 'app');
const MARCA = 'Praça Araguaia';

function paginas(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === 'api' ? [] : paginas(caminho);
    return nome === 'page.tsx' ? [caminho] : [];
  });
}

describe('título da aba', () => {
  it('o layout define o template com a marca na frente', () => {
    const layout = readFileSync(join(RAIZ, 'layout.tsx'), 'utf-8');
    expect(layout).toContain(`template: '${MARCA} — %s'`);
    expect(layout).toContain(`default: '${MARCA}`);
  });

  it('a home escreve o título inteiro (o template não a alcança)', () => {
    const home = readFileSync(join(RAIZ, 'page.tsx'), 'utf-8');
    expect(home).toMatch(new RegExp(`title:\\s*'${MARCA} — `));
  });

  it('as demais páginas declaram só o próprio nome, sem repetir a marca', () => {
    // Repetir a marca aqui produziria "Praça Araguaia — X — Praça Araguaia".
    for (const caminho of paginas(RAIZ)) {
      if (caminho === join(RAIZ, 'page.tsx')) continue;
      const fonte = readFileSync(caminho, 'utf-8');
      const titulos = [...fonte.matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
      for (const t of titulos) {
        expect(t, `${caminho} repete a marca no título`).not.toContain(MARCA);
      }
    }
  });

  it('toda página tem título próprio — nenhuma cai no padrão do layout', () => {
    // /cotacoes foi para produção sem título: era a home e nunca precisou de um.
    const semTitulo = paginas(RAIZ).filter((caminho) => {
      const fonte = readFileSync(caminho, 'utf-8');
      return !/title:/.test(fonte) && !/generateMetadata/.test(fonte);
    });
    expect(semTitulo, `páginas sem título: ${semTitulo.join(', ')}`).toEqual([]);
  });
});
