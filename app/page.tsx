import Link from 'next/link';
import { buscarNoticias } from '@/lib/noticias/buscar';
import { FEEDS } from '@/lib/noticias/feeds';
import { GradeNoticias } from '@/components/redesign/GradeNoticias';

// Sem banco e sem cron: a página se refaz a cada 15 min, no primeiro acesso depois
// do prazo. O plano grátis da Vercel dispara cron 1x/dia, então ISR é o único jeito
// de ter notícia de hora em hora sem pagar. A GradeNoticias ainda chama router.refresh()
// a cada 15 min, para quem deixa a aba aberta.
export const revalidate = 900;

export const metadata = {
  title: 'Notícias do Mercado — Praça Araguaia',
  description:
    'As notícias do agro, da pecuária e do mercado que mexem com o preço na porteira, reunidas dos principais veículos do país.',
};

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Araguaina' });

export default async function Home() {
  const noticias = await buscarNoticias();
  const agora = new Date();

  return (
    <div className="wrap">
      <section className="nhero">
        <div className="kicker">Notícias do mercado</div>
        <h1>
          O que mexe
          <br />
          <em>com o preço</em>.
        </h1>
        <p className="lede">
          Agro, pecuária, grãos e mercado — reunido dos principais veículos do país. O card leva direto para a
          reportagem no site de origem.
        </p>
        <div className="nmeta">
          <div className="big">{fmtHoje.format(agora)}</div>
          <div className="mono">Atualizado {fmtHora.format(agora)} · a cada 15 min · {FEEDS.length} veículos</div>
        </div>
      </section>

      {noticias.length === 0 ? (
        // Todos os feeds fora do ar. Estado honesto, com saída para o que funciona.
        <section className="section">
          <p className="mono nvazio">
            As notícias não carregaram agora. Elas voltam sozinhas na próxima atualização —{' '}
            <Link href="/cotacoes">veja as cotações de hoje</Link>.
          </p>
        </section>
      ) : (
        <section className="nsecao">
          <GradeNoticias noticias={noticias} />
        </section>
      )}
    </div>
  );
}
