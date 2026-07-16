import { createServerClient } from '@/lib/supabase/server';

// Conta um acesso, por cidade, sem saber quem acessou.
//
// A cidade vem dos headers de geo da Vercel (grátis, sem pop-up, sem cookie) — os
// mesmos que /api/geo já usa. O IP não é lido nem gravado: a Vercel resolve a
// cidade antes de a requisição chegar aqui.

export const dynamic = 'force-dynamic';

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }); // YYYY-MM-DD

export async function POST(req: Request): Promise<Response> {
  const h = req.headers;
  const cidadeRaw = h.get('x-vercel-ip-city');
  const uf = h.get('x-vercel-ip-country-region');
  const pais = h.get('x-vercel-ip-country');

  // Fora do Brasil não é a praça, e sem cidade/UF não há o que contar. Responde 204
  // do mesmo jeito: o beacon não tem nada a fazer com o erro, e o visitante não
  // precisa saber que a gente conta.
  if (pais !== 'BR' || !cidadeRaw || !uf) return new Response(null, { status: 204 });

  // O header vem URL-encoded: 'S%C3%A3o%20F%C3%A9lix' viraria uma cidade nova, ao
  // lado de 'São Félix', no ranking do painel.
  let cidade: string;
  try {
    cidade = decodeURIComponent(cidadeRaw).trim().slice(0, 60);
  } catch {
    return new Response(null, { status: 204 }); // header malformado: não conta lixo
  }
  if (cidade === '') return new Response(null, { status: 204 });

  try {
    const supabase = createServerClient();
    const { error } = await supabase.rpc('registrar_visita', {
      p_dia: fmtDia.format(new Date()),
      p_cidade: cidade,
      p_uf: uf.trim().toUpperCase().slice(0, 2),
    });
    if (error) console.error('registrar_visita falhou', error);
  } catch (e) {
    // Contagem de audiência jamais pode atrapalhar quem está lendo o site.
    console.error('visita falhou', e);
  }

  return new Response(null, { status: 204 });
}
