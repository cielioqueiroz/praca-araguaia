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
  // Escrito por extenso, e não 'Notícias do Mercado' + template: o title.template do
  // layout só vale para segmentos FILHOS, e a home divide o segmento raiz com ele.
  // Confiar no template aqui deixava a aba como "Notícias do Mercado", sem a marca.
  title: 'Praça Araguaia — Notícias do Mercado',
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
      {/* Mesmo hero de duas colunas de /cotacoes — o site já fala assim. Lá o touro,
          aqui a lavoura no fim da tarde: a mesma praça, outro assunto. */}
      <section className="hero nhero">
        <div className="text">
          <div className="kicker">Notícias do mercado</div>
          <h1>
            O que mexe
            <br />
            <em>com o preço</em>.
          </h1>
          <p className="lede">
            Agro, pecuária, grãos e mercado — dos principais veículos do país, num lugar só.
          </p>
          <div className="meta">
            <div className="big">{fmtHoje.format(agora)}</div>
            <div className="mono">Atualizado {fmtHora.format(agora)} · a cada 15 min · {FEEDS.length} veículos</div>
          </div>
        </div>
        <div className="photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/lavoura-dourada.jpg" alt="Lavoura no fim da tarde" />
          <div className="overlay" />
          <span className="tag">Vale do Araguaia</span>
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
