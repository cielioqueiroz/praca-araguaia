import { createServerClient } from '@/lib/supabase/server';
import { autorizadoPorCron } from '@/lib/cron';
import { dataLocal, diaUtil } from '@/lib/dia-util';
import { enviarFotoArquivo } from '@/lib/telegram';
import { legendaBoletim, urlFotoBoletim, type Sessao } from '@/lib/telegram-boletim';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
import { pendenciasDaColeta, type LinhaAtualizada } from '@/lib/boletim-envio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) {
    return new Response('unauthorized', { status: 401 });
  }

  const params = new URL(req.url).searchParams;

  const sessaoParam = params.get('sessao');
  if (sessaoParam && sessaoParam !== 'abertura' && sessaoParam !== 'fechamento') {
    return new Response('sessao invalida', { status: 400 });
  }
  const sessao: Sessao = sessaoParam === 'abertura' ? 'abertura' : 'fechamento';

  // Modo prévia (?previa=1): manda o card SÓ para o chat do dono, para ele conferir
  // como a peça chega no celular antes de ela ir para os inscritos. Nunca faz
  // broadcast. Sem TELEGRAM_DONO_CHAT_ID, não há para quem mandar a prévia.
  const previa = params.get('previa') !== null;

  // SÁBADO, DOMINGO E FERIADO NACIONAL NÃO TÊM BOLETIM. O card fala de pregão e de
  // arroba negociada: sem mercado aberto, ele só repetiria o número de sexta com a
  // data de hoje — a mesma cara de "congelado" que o dono relatou. O cron já
  // recorta segunda a sexta, mas ele não conhece feriado; esta é a tranca que vale.
  //
  // A prévia passa: ela vai só para o dono, que pode querer conferir a peça num
  // domingo justamente porque tem tempo.
  if (!previa) {
    const veredito = diaUtil();
    if (!veredito.ehDiaUtil) {
      console.log(`enviar-boletim: sem envio hoje (${veredito.motivo})`);
      return Response.json({ enviados: 0, removidos: 0, falhas: 0, pulado: veredito.motivo });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  // O segredo já existe (autorizadoPorCron não deixaria passar sem ele), mas quem lê
  // esta linha não deveria precisar saber disso para entender que ela é segura.
  const segredo = process.env.CRON_SECRET;
  if (!token || !segredo) return new Response('config', { status: 500 });

  const supabase = createServerClient();

  let chatIds: number[];
  if (previa) {
    const donoRaw = process.env.TELEGRAM_DONO_CHAT_ID;
    const dono = Number(donoRaw);
    // String vazia vira 0 no Number e passaria como "finito": exige valor de fato.
    if (!donoRaw || !Number.isFinite(dono) || dono === 0) {
      return new Response('sem TELEGRAM_DONO_CHAT_ID', { status: 500 });
    }
    chatIds = [dono];
  } else {
    const { data, error } = await supabase.from('assinantes_telegram').select('chat_id');
    if (error) {
      console.error('enviar-boletim: leitura dos inscritos falhou', error);
      return new Response('erro', { status: 500 });
    }
    chatIds = (data ?? []).map((r) => r.chat_id as number);
  }

  if (chatIds.length === 0) {
    return Response.json({ enviados: 0, removidos: 0, falhas: 0 });
  }

  const agora = new Date();
  const dia = dataLocal(agora);
  if (!previa) {
    const [cotacoes, pracas, ufs] = await Promise.all([
      supabase.from('cotacoes').select('tipo,atualizado_em'),
      supabase.from('cotacoes_praca').select('tipo,atualizado_em'),
      supabase.from('cotacoes_uf').select('tipo,atualizado_em'),
    ]);
    if (cotacoes.error || pracas.error || ufs.error) {
      console.error('enviar-boletim: leitura da coleta falhou', {
        cotacoes: cotacoes.error, pracas: pracas.error, ufs: ufs.error,
      });
      return new Response('erro na coleta', { status: 500 });
    }
    const pendencias = pendenciasDaColeta(dia, {
      cotacoes: (cotacoes.data ?? []) as LinhaAtualizada[],
      pracas: (pracas.data ?? []) as LinhaAtualizada[],
      ufs: (ufs.data ?? []) as LinhaAtualizada[],
    });
    if (pendencias.length > 0) {
      console.error('enviar-boletim: coleta incompleta', { dia, pendencias });
      return Response.json({ dia, pendencias }, { status: 503 });
    }
  }
  const caption = previa
    ? `📋 Prévia (só para você). ${legendaBoletim(agora, sessao)}`
    : legendaBoletim(agora, sessao);

  // Renderiza o card UMA vez e envia os bytes para todo mundo. Antes mandávamos a URL,
  // e o Telegram tinha de buscá-la: como o card leva ~10s para desenhar, ele desistia
  // e o envio falhava (e, quando dava certo, servia a foto do cache dele).
  const resposta = await fetch(urlFotoBoletim(agora, segredo));
  if (!resposta.ok) {
    console.error('enviar-boletim: card não renderizou', resposta.status);
    return new Response('card indisponivel', { status: 502 });
  }
  const imagem = await resposta.blob();

  // A reserva vem depois de renderizar: uma imagem com erro não consome a entrega.
  // Depois da primeira mensagem, porém, uma nova tentativa poderia duplicá-la;
  // por isso a reserva permanece mesmo se o processo parar no meio do envio.
  if (!previa) {
    const { error } = await supabase.from('envios_boletim').insert({ dia, sessao });
    if (error?.code === '23505') {
      return Response.json({ dia, sessao, pulado: 'envio ja iniciado' });
    }
    if (error) {
      console.error('enviar-boletim: reserva falhou', error);
      return new Response('erro na reserva', { status: 500 });
    }
  }

  const { enviados, bloqueados, falhas } = await enviarEmMassa({
    chatIds,
    enviar: (chatId) => enviarFotoArquivo(token, chatId, imagem, caption),
  });

  // Só o broadcast poda inscrito que bloqueou o bot. Na prévia, o "chat" é o dono —
  // um bloqueio dele não é motivo para apagar ninguém da lista de inscritos.
  if (!previa && bloqueados.length > 0) {
    const { error: delErro } = await supabase.from('assinantes_telegram').delete().in('chat_id', bloqueados);
    if (delErro) console.error('enviar-boletim: remoção de bloqueados falhou', delErro);
  }

  if (!previa) {
    const { error } = await supabase.from('envios_boletim')
      .update({ concluido_em: new Date().toISOString(), enviados, removidos: bloqueados.length, falhas })
      .eq('dia', dia).eq('sessao', sessao);
    if (error) console.error('enviar-boletim: resultado não registrado', error);
  }

  return Response.json({ enviados, removidos: bloqueados.length, falhas });
}
