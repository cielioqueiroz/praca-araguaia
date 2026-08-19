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
    <div className="pnum">
      <div className="v tnum">{n}</div>
      <div className="r mono">{rotulo}</div>
    </div>
  );
}

export default async function Painel() {
  const senha = process.env.MODERACAO_SENHA;
  const token = (await cookies()).get(COOKIE_MODERACAO)?.value;
  const autenticado = Boolean(senha && token && verificarToken(token, Date.now(), senha));

  if (!autenticado) {
    return (
      <div className="wrap">
        <section className="pghero">
          <div className="kicker">Área restrita</div>
          <h1>Audiência</h1>
          <p className="lede">Entre com a senha para ver quem está acompanhando a praça.</p>
        </section>
        <div className="pgcard estreito">
          <FormLoginModeracao />
        </div>
      </div>
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
      <div className="wrap">
        <section className="pghero">
          <div className="kicker">Área restrita</div>
          <h1>Audiência</h1>
        </section>
        <div className="pgcard estreito">
          <p className="pgerro">Não consegui carregar os números — tente recarregar.</p>
        </div>
      </div>
    );
  }

  const r = resumirAudiencia(
    (inscritos ?? []) as InscritoBruto[],
    (visitas ?? []) as VisitaBruta[],
    hoje,
  );

  return (
    <div className="wrap">
      <section className="pghero">
        <div className="kicker">Área restrita</div>
        <h1>Audiência</h1>
        <div className="pgmeta mono">{fmtExtenso.format(new Date())}</div>
      </section>

      <div className="pnums">
        <Numero n={r.totalInscritos} rotulo="Inscritos no Telegram" />
        <Numero n={r.totalAcessosHoje} rotulo="Acessos hoje" />
        <Numero n={r.totalAcessos7d} rotulo="Acessos em 7 dias" />
      </div>

      <div className="section-head" style={{ marginTop: 46 }}>
        <h2 className="t">Por cidade</h2>
        <div className="line" />
      </div>

      {r.linhas.length === 0 ? (
        <p className="cidnota">
          Ainda sem cidade registrada. Os acessos aparecem aqui assim que alguém abrir o site; os inscritos, quando
          entrarem pelo botão do rodapé.
        </p>
      ) : (
        <ul className="plista">
          {r.linhas.map((l) => (
            <li key={`${l.cidade}-${l.uf}`}>
              <span className="l">
                {l.cidade}
                <i>{l.uf}</i>
              </span>
              <span className="n mono tnum">
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
        <p className="cidnota">
          {r.inscritosSemCidade} {r.inscritosSemCidade === 1 ? 'inscrito entrou' : 'inscritos entraram'} antes de o
          convite levar a cidade, ou direto pelo @ do bot — {r.inscritosSemCidade === 1 ? 'ele conta' : 'eles contam'} no
          total, mas não {r.inscritosSemCidade === 1 ? 'aparece' : 'aparecem'} na lista.
        </p>
      )}

      <p className="cidnota">
        Só cidade e contagem. Nada de nome, telefone ou IP — nem aqui, nem no banco.
      </p>
    </div>
  );
}
