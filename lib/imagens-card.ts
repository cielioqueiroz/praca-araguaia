import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// O Satori não busca imagem externa de forma confiável no serverless: os recortes
// entram embutidos como data URI. Cache em módulo — o arquivo não muda em runtime.
const cache = new Map<string, string | null>();

export function imagemDoAtivo(tipo: string): string | null {
  const guardado = cache.get(tipo);
  if (guardado !== undefined) return guardado;

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
