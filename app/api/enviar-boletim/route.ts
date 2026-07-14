import { createServerClient } from '@/lib/supabase/server';
import { enviarFotoArquivo } from '@/lib/telegram';
import { legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';
import { enviarEmMassa } from '@/lib/telegram-broadcast';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response('config', { status: 500 });

  const supabase = createServerClient();
  const { data, error } = await supabase.from('assinantes_telegram').select('chat_id');
  if (error) {
    console.error('enviar-boletim: leitura dos inscritos falhou', error);
    return new Response('erro', { status: 500 });
  }

  const chatIds = (data ?? []).map((r) => r.chat_id as number);
  if (chatIds.length === 0) {
    return Response.json({ enviados: 0, removidos: 0, falhas: 0 });
  }

  const agora = new Date();
  const caption = legendaBoletim(agora);

  // Renderiza o card UMA vez e envia os bytes para todo mundo. Antes mandávamos a URL,
  // e o Telegram tinha de buscá-la: como o card leva ~10s para desenhar, ele desistia
  // e o envio falhava (e, quando dava certo, servia a foto do cache dele).
  const resposta = await fetch(urlFotoBoletim(agora));
  if (!resposta.ok) {
    console.error('enviar-boletim: card não renderizou', resposta.status);
    return new Response('card indisponivel', { status: 502 });
  }
  const imagem = await resposta.blob();

  const { enviados, bloqueados, falhas } = await enviarEmMassa({
    chatIds,
    enviar: (chatId) => enviarFotoArquivo(token, chatId, imagem, caption),
  });

  if (bloqueados.length > 0) {
    const { error: delErro } = await supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados);
    if (delErro) console.error('enviar-boletim: remoção de bloqueados falhou', delErro);
  }

  return Response.json({ enviados, removidos: bloqueados.length, falhas });
}
