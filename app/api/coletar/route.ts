import { coletarCotacao } from '@/lib/coleta';
import { FONTES } from '@/lib/fontes/registry';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseRepo } from '@/lib/supabase/repo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const repo = supabaseRepo(createServerClient());
  const coletadas: Array<{ tipo: string; valor: number }> = [];
  const erros: Array<{ tipo: string; erro: string }> = [];

  for (const [tipo, fonte] of Object.entries(FONTES)) {
    try {
      const r = await coletarCotacao(fonte, repo);
      coletadas.push({ tipo, valor: r.valor });
    } catch (e) {
      console.error(`coleta ${tipo} falhou`, e);
      erros.push({ tipo, erro: (e as Error).message });
    }
  }

  const status = coletadas.length === 0 ? 502 : 200;
  return Response.json({ coletadas, erros }, { status });
}
