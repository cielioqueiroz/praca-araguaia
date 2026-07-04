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
