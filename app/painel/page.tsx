import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { verificarToken, COOKIE_MODERACAO } from '@/lib/moderacao';
import { resumirAudiencia, type InscritoBruto, type VisitaBruta } from '@/lib/audiencia';
import { FormLoginModeracao } from '@/components/FormLoginModeracao';

// Quem está acompanhando a praça, por cidade. Fora do menu e fora do Google:
// é a página do dono, não do produtor.
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Audiência',
  robots: { index: false },
};

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' });
const fmtExtenso = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });

function Numero({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <div className="rounded-xl border border-linha bg-papel px-5 py-4">
      <div className="font-display text-3xl tabular-nums text-mata">{n}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{rotulo}</div>
    </div>
  );
}

export default async function Painel() {
  const senha = process.env.MODERACAO_SENHA;
  const token = (await cookies()).get(COOKIE_MODERACAO)?.value;
  const autenticado = Boolean(senha && token && verificarToken(token, Date.now(), senha));

  if (!autenticado) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Área restrita</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Audiência</h1>
        <p className="mt-1 text-sm text-tinta/50">Entre com a senha para ver quem está acompanhando.</p>
        <div className="mt-6">
          <FormLoginModeracao />
        </div>
      </main>
    );
  }

  const hoje = fmtDia.format(new Date());
  const seteDias = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

  // As duas tabelas têm RLS fechada: só o service role enxerga.
  const supabase = createServerClient();
  const [{ data: inscritos, error: e1 }, { data: visitas, error: e2 }] = await Promise.all([
    supabase.from('assinantes_telegram').select('cidade, uf'),
    supabase.from('visitas').select('dia, cidade, uf, acessos').gte('dia', fmtDia.format(seteDias)),
  ]);

  if (e1 || e2) {
    // Erro de banco é erro, não "ainda não tem ninguém" — a lição anotada no
    // Termômetro, que mascarava falha como estado vazio.
    console.error('painel de audiência falhou', e1 ?? e2);
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mata">Audiência</h1>
        <div className="mt-6 rounded-xl border border-linha bg-papel p-6">
          <p className="text-sm font-medium text-red-600">Não consegui carregar os números — tente recarregar.</p>
        </div>
      </main>
    );
  }

  const r = resumirAudiencia(
    (inscritos ?? []) as InscritoBruto[],
    (visitas ?? []) as VisitaBruta[],
    hoje,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Área restrita</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Audiência</h1>
      <p className="mt-1 text-sm text-tinta/50">{fmtExtenso.format(new Date())}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Numero n={r.totalInscritos} rotulo="Inscritos no Telegram" />
        <Numero n={r.totalAcessosHoje} rotulo="Acessos hoje" />
        <Numero n={r.totalAcessos7d} rotulo="Acessos em 7 dias" />
      </div>

      <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-ink2">Por cidade</h2>

      {r.linhas.length === 0 ? (
        <p className="mt-4 text-sm text-tinta/50">
          Ainda sem cidade registrada. Os acessos aparecem aqui assim que alguém abrir o site; os inscritos, quando
          entrarem pelo botão do rodapé.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-linha rounded-xl border border-linha bg-papel">
          {r.linhas.map((l) => (
            <li key={`${l.cidade}-${l.uf}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
              <span className="text-[15px] text-ink">
                {l.cidade}
                <i className="ml-1.5 font-mono text-[10px] not-italic uppercase tracking-[0.1em] text-muted">{l.uf}</i>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink2">
                {l.inscritos} {l.inscritos === 1 ? 'inscrito' : 'inscritos'}
                <span className="mx-1.5 text-muted">·</span>
                {l.acessosHoje} {l.acessosHoje === 1 ? 'acesso' : 'acessos'} hoje
                <span className="mx-1.5 text-muted">·</span>
                <span className="text-muted">{l.acessos7d} em 7 dias</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {r.inscritosSemCidade > 0 && (
        <p className="mt-4 text-xs text-tinta/45">
          {r.inscritosSemCidade} {r.inscritosSemCidade === 1 ? 'inscrito entrou' : 'inscritos entraram'} antes de o
          convite levar a cidade, ou direto pelo @ do bot — {r.inscritosSemCidade === 1 ? 'ele conta' : 'eles contam'} no
          total, mas não {r.inscritosSemCidade === 1 ? 'aparece' : 'aparecem'} na lista.
        </p>
      )}

      <p className="mt-8 text-xs leading-relaxed text-tinta/45">
        Só cidade e contagem. Nada de nome, telefone ou IP — nem aqui, nem no banco.
      </p>
    </main>
  );
}
