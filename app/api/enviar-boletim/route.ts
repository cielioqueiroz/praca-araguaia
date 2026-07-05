import { createServerClient } from '@/lib/supabase/server';
import { enviarFoto } from '@/lib/telegram';
import { enviarBoletim, legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';

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
  const url = urlFotoBoletim(agora);
  const caption = legendaBoletim(agora);

  const { enviados, bloqueados, falhas } = await enviarBoletim({
    chatIds,
    enviar: (chatId) => enviarFoto(token, chatId, url, caption),
  });

  if (bloqueados.length > 0) {
    const { error: delErro } = await supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados);
    if (delErro) console.error('enviar-boletim: remoção de bloqueados falhou', delErro);
  }

  return Response.json({ enviados, removidos: bloqueados.length, falhas });
}
