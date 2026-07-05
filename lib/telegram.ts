export type IntencaoTelegram =
  | { tipo: 'start'; chatId: number }
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
  const comando = texto.trim().toLowerCase();
  if (comando.startsWith('/start')) return { tipo: 'start', chatId };
  if (comando.startsWith('/parar')) return { tipo: 'parar', chatId };
  return { tipo: 'ajuda', chatId };
}

// Envia uma mensagem de texto via Bot API. fetchImpl injetável para teste.
export async function enviarMensagem(
  token: string,
  chatId: number,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  if (!res.ok) console.error('Telegram sendMessage falhou', res.status);
}

export type ResultadoEnvio = { ok: true } | { ok: false; bloqueado: boolean };

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
