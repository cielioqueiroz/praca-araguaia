export type IntencaoTelegram =
  | { tipo: 'start'; chatId: number; carga: string | null }
  | { tipo: 'parar'; chatId: number }
  | { tipo: 'ajuda'; chatId: number }
  | { tipo: 'ignorar' };

export const TEXTO_BOAS_VINDAS =
  'Pronto! Você vai receber o boletim diário da Praça Araguaia por aqui. ' +
  'Para sair quando quiser, é só mandar /parar.';
export const TEXTO_DESPEDIDA =
  'Você saiu dos avisos da Praça Araguaia. Quando quiser voltar, mande /start.';
export const TEXTO_AJUDA =
  'Praça Araguaia no Telegram:\n/start — receber o boletim diário\n/parar — sair dos avisos';

// Lê um update do Telegram e devolve a intenção. Puro: não faz I/O.
export function interpretarUpdate(update: unknown): IntencaoTelegram {
  const msg = (update as { message?: { text?: unknown; chat?: { id?: unknown } } } | null)?.message;
  const texto = msg?.text;
  const chatId = msg?.chat?.id;
  if (typeof texto !== 'string' || typeof chatId !== 'number') return { tipo: 'ignorar' };

  const cru = texto.trim();
  const comando = cru.toLowerCase();

  if (comando.startsWith('/start')) {
    // A carga vem do texto CRU, nunca do minusculado: ela é base64url e sensível a
    // caixa — 'T2NyaQ' virado 't2nyaq' decodifica noutra coisa ou em nada.
    //
    // Em grupo o Telegram manda '/start@NomeDoBot': o sufixo é endereçamento, não
    // carga. Sem tirá-lo, '@PracaBot' viraria a "cidade" do inscrito.
    const carga = cru
      .slice('/start'.length)
      .replace(/^@\S+/, '')
      .trim();
    return { tipo: 'start', chatId, carga: carga === '' ? null : carga };
  }
  if (comando.startsWith('/parar')) return { tipo: 'parar', chatId };
  return { tipo: 'ajuda', chatId };
}

// Compat: o webhook não precisa do status de bloqueio. Delega em enviarTexto.
export async function enviarMensagem(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await enviarTexto(token, chatId, texto, fetchImpl);
}

export type ResultadoEnvio = { ok: true } | { ok: false; bloqueado: boolean };

// Envia uma mensagem de texto via Bot API, sinalizando bloqueio (403).
// fetchImpl injetável para teste.
export async function enviarTexto(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, bloqueado: true };
  console.error('Telegram sendMessage falhou', res.status);
  return { ok: false, bloqueado: false };
}

// Envia uma foto (por URL — o Telegram baixa a imagem) via Bot API.
// 403 = bot bloqueado / conta desativada → sinaliza remoção do inscrito.
export async function enviarFoto(
  token: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, bloqueado: true };
  console.error('Telegram sendPhoto falhou', res.status);
  return { ok: false, bloqueado: false };
}

// Envia a foto como ARQUIVO (multipart), em vez de mandar a URL.
//
// Por que não a URL: o card é renderizado sob demanda (Satori) e leva ~10s. Quando o
// Telegram vai buscar a URL, ele desiste antes de a imagem ficar pronta e o envio
// falha. Além disso, ele cacheia foto remota por URL — o que já nos fez reentregar o
// card do dia anterior. Enviando os bytes, os dois problemas somem.
export async function enviarFotoArquivo(
  token: string,
  chatId: number,
  imagem: Blob,
  caption: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('photo', imagem, 'boletim.png');

  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form, // sem content-type na mão: o boundary vem do FormData
  });
  if (res.ok) return { ok: true };
  if (res.status === 403) return { ok: false, bloqueado: true };
  console.error('Telegram sendPhoto (arquivo) falhou', res.status);
  return { ok: false, bloqueado: false };
}
