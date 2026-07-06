import { createServerClient } from '@/lib/supabase/server';
import { enviarTexto } from '@/lib/telegram';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
import { detectarMovers, montarMensagemAlerta } from '@/lib/telegram-alertas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response('config', { status: 500 });

  const zero = { alertados: 0, enviados: 0, removidos: 0, falhas: 0 };
  const supabase = createServerClient();

  const cots = await supabase
    .from('cotacoes')
    .select('tipo, valor, unidade, variacao_pct, data_referencia');
  if (cots.error) {
    console.error('alertas: leitura de cotacoes falhou', cots.error);
    return new Response('erro', { status: 500 });
  }

  const movers = detectarMovers(cots.data ?? []);
  if (movers.length === 0) return Response.json(zero);

  const ja = await supabase.from('alertas_enviados').select('tipo, data_referencia');
  if (ja.error) {
    console.error('alertas: leitura de alertas_enviados falhou', ja.error);
    return new Response('erro', { status: 500 });
  }
  const jaSet = new Set((ja.data ?? []).map((r) => `${r.tipo}|${r.data_referencia}`));
  const novos = movers.filter((m) => !jaSet.has(`${m.tipo}|${m.dataReferencia}`));
  if (novos.length === 0) return Response.json(zero);

  const texto = montarMensagemAlerta(novos, new Date());

  const subs = await supabase.from('assinantes_telegram').select('chat_id');
  if (subs.error) {
    console.error('alertas: leitura de inscritos falhou', subs.error);
    return new Response('erro', { status: 500 });
  }
  const chatIds = (subs.data ?? []).map((r) => r.chat_id as number);

  const { enviados, bloqueados, falhas } = await enviarEmMassa({
    chatIds,
    enviar: (chatId) => enviarTexto(token, chatId, texto),
  });

  if (bloqueados.length > 0) {
    const del = await supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados);
    if (del.error) console.error('alertas: remoção de bloqueados falhou', del.error);
  }

  const ins = await supabase.from('alertas_enviados').insert(
    novos.map((m) => ({ tipo: m.tipo, data_referencia: m.dataReferencia, variacao_pct: m.variacaoPct })),
  );
  if (ins.error) console.error('alertas: gravação dos marcadores falhou', ins.error);

  return Response.json({ alertados: novos.length, enviados, removidos: bloqueados.length, falhas });
}
