import { describe, it, expect, vi } from 'vitest';
import { interpretarUpdate, enviarMensagem, enviarFoto, enviarTexto } from '@/lib/telegram';

const msg = (text: string, id: number = 42) => ({ message: { text, chat: { id } } });

describe('interpretarUpdate', () => {
  it('/start vira start com o chatId, sem carga', () => {
    expect(interpretarUpdate(msg('/start'))).toEqual({ tipo: 'start', chatId: 42, carga: null });
  });

  it('/start <carga> guarda a carga do convite, preservando a caixa', () => {
    // A carga é base64url e sensível a caixa: minusculá-la decodificaria noutra
    // cidade — ou em nada. Vem do link t.me/bot?start=<carga> do rodapé do site.
    expect(interpretarUpdate(msg('/start T3VyaWN1cml8UEU'))).toEqual({
      tipo: 'start', chatId: 42, carga: 'T3VyaWN1cml8UEU',
    });
  });

  it('/parar vira parar', () => {
    expect(interpretarUpdate(msg('/parar'))).toEqual({ tipo: 'parar', chatId: 42 });
  });

  it('o sufixo do bot em grupo não é carga', () => {
    // Em grupo o Telegram manda '/start@NomeDoBot'. Sem tirar o sufixo, '@PracaBot'
    // viraria a "cidade" do inscrito no painel de audiência.
    expect(interpretarUpdate(msg('/start@PracaBot'))).toEqual({ tipo: 'start', chatId: 42, carga: null });
    expect(interpretarUpdate(msg('/start@PracaBot T3VyaWN1cml8UEU'))).toEqual({
      tipo: 'start', chatId: 42, carga: 'T3VyaWN1cml8UEU',
    });
  });

  it('o comando é case-insensitive', () => {
    expect(interpretarUpdate(msg('/START agora'))).toEqual({ tipo: 'start', chatId: 42, carga: 'agora' });
  });

  it('qualquer outro texto vira ajuda', () => {
    expect(interpretarUpdate(msg('oi'))).toEqual({ tipo: 'ajuda', chatId: 42 });
  });

  it('update sem mensagem de texto vira ignorar', () => {
    expect(interpretarUpdate({})).toEqual({ tipo: 'ignorar' });
    expect(interpretarUpdate({ message: { chat: { id: 42 } } })).toEqual({ tipo: 'ignorar' });
    expect(interpretarUpdate(null)).toEqual({ tipo: 'ignorar' });
  });

  it('mensagem de texto sem chat.id numérico vira ignorar', () => {
    expect(interpretarUpdate({ message: { text: '/start', chat: {} } })).toEqual({ tipo: 'ignorar' });
  });
});

describe('enviarMensagem', () => {
  it('faz POST em sendMessage com chat_id e text', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    await enviarMensagem('TOKEN123', 42, 'olá', fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 42, text: 'olá' });
  });
});

describe('enviarFoto', () => {
  it('faz POST em sendPhoto com chat_id, photo e caption; ok em 200', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const r = await enviarFoto('TOKEN123', 42, 'https://x/foto.png', 'legenda', fetchMock);
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendPhoto');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: 42,
      photo: 'https://x/foto.png',
      caption: 'legenda',
    });
  });

  it('403 (bot bloqueado) vira bloqueado:true', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const r = await enviarFoto('TOKEN123', 42, 'https://x/foto.png', 'legenda', fetchMock);
    expect(r).toEqual({ ok: false, bloqueado: true });
  });

  it('outro erro vira bloqueado:false', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    const r = await enviarFoto('TOKEN123', 42, 'https://x/foto.png', 'legenda', fetchMock);
    expect(r).toEqual({ ok: false, bloqueado: false });
  });
});

describe('enviarTexto', () => {
  it('faz POST em sendMessage com chat_id e text; ok em 200', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const r = await enviarTexto('TOKEN123', 42, 'alô', fetchMock);
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 42, text: 'alô' });
  });

  it('403 (bot bloqueado) vira bloqueado:true', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    expect(await enviarTexto('T', 42, 'x', fetchMock)).toEqual({ ok: false, bloqueado: true });
  });

  it('outro erro vira bloqueado:false', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    expect(await enviarTexto('T', 42, 'x', fetchMock)).toEqual({ ok: false, bloqueado: false });
  });
});
