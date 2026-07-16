import { createServerClient } from '@/lib/supabase/server';
import { decodificarConvite } from '@/lib/audiencia';
import {
  interpretarUpdate,
  enviarMensagem,
  TEXTO_BOAS_VINDAS,
  TEXTO_DESPEDIDA,
  TEXTO_AJUDA,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return new Response('config', { status: 500 });
  }
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response('ok', { status: 200 }); // corpo inválido: não gerar retry
  }

  const intencao = interpretarUpdate(update);
  if (intencao.tipo === 'ignorar') return new Response('ok', { status: 200 });

  try {
    const supabase = createServerClient();
    if (intencao.tipo === 'start') {
      // A cidade vem na carga do link do convite (o Telegram não a informa). Carga
      // ausente ou inválida = inscrito sem cidade, que é o normal para quem chega
      // pelo @ do bot em vez de pelo botão do site.
      const convite = intencao.carga ? decodificarConvite(intencao.carga) : null;

      // Com cidade, sobrescreve: quem já era inscrito e clicou no botão do site de
      // novo passa a ter cidade. Sem cidade, ignoreDuplicates — um /start sem carga
      // (pelo @ do bot) não pode apagar a cidade que já sabíamos.
      const { error } = convite
        ? await supabase
            .from('assinantes_telegram')
            .upsert({ chat_id: intencao.chatId, cidade: convite.cidade, uf: convite.uf }, { onConflict: 'chat_id' })
        : await supabase
            .from('assinantes_telegram')
            .upsert({ chat_id: intencao.chatId }, { onConflict: 'chat_id', ignoreDuplicates: true });
      if (error) console.error('telegram upsert falhou', error);
      await enviarMensagem(token, intencao.chatId, TEXTO_BOAS_VINDAS);
    } else if (intencao.tipo === 'parar') {
      const { error } = await supabase.from('assinantes_telegram').delete().eq('chat_id', intencao.chatId);
      if (error) console.error('telegram delete falhou', error);
      await enviarMensagem(token, intencao.chatId, TEXTO_DESPEDIDA);
    } else {
      await enviarMensagem(token, intencao.chatId, TEXTO_AJUDA);
    }
  } catch (e) {
    console.error('webhook telegram falhou', e); // 200 mesmo assim, para o Telegram não re-tentar em loop
  }

  return new Response('ok', { status: 200 });
}
