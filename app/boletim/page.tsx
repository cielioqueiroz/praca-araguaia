import Link from 'next/link';
import { BotaoCompartilhar } from '@/components/redesign/BotaoCompartilhar';
import { BotaoTelegram } from '@/components/redesign/BotaoTelegram';

export const metadata = {
  title: 'Boletim do dia',
  description: 'O card com o preço do dia na porteira e no mercado, pronto para mandar no grupo.',
};

const fmtHoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Araguaina' });

function IconeBaixar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" />
      <path d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17" />
    </svg>
  );
}

// A página existia para "baixar imagem" e mais nada — sendo que ela é, das nossas
// páginas, a única cujo propósito INTEIRO é sair daqui e ir parar num grupo. Agora
// as três saídas estão lado a lado: mandar agora, baixar para postar, receber todo
// dia sozinho.
export default function Boletim() {
  return (
    <div className="wrap">
      <section className="bolhead">
        <div className="kicker">Boletim do dia</div>
        <h1>
          O dia inteiro
          <br />
          <em>num card</em>.
        </h1>
        <p className="lede">
          Porteira e mercado, com a data e a fonte de cada preço. Feito para caber na tela do celular de quem
          está na lida.
        </p>
        <div className="bolmeta mono">{fmtHoje.format(new Date())}</div>
      </section>

      <section className="bolgrade">
        <div className="bolcard">
          {/* Imagem dinâmica gerada pela rota; next/image não otimiza rota própria. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/boletim" alt="Boletim do dia com as cotações da Praça Araguaia" />
        </div>

        <div className="bolacoes">
          <div className="bolt">O que fazer com ele</div>

          <BotaoCompartilhar alvo="boletim" className="fc-btn bol-primario" rotulo="Mandar no WhatsApp" />

          <a href="/api/boletim" download="boletim-praca-araguaia.png" className="fc-btn bol-secundario">
            <IconeBaixar className="h-[18px] w-[18px]" />
            Baixar a imagem
          </a>

          <div className="bolsep" />

          <p className="bolnota">
            Não quer lembrar de vir aqui? O bot manda o card no fim de cada dia útil, quando o preço do dia já
            está apurado.
          </p>
          <BotaoTelegram className="fc-btn bol-secundario" />

          <p className="bolrodape">
            O card sai do mesmo dado do site — <Link href="/cotacoes">a praça hoje</Link> — e traz a data de
            apuração de cada preço. Preço parado vem marcado como desatualizado; aqui número velho não passa
            por novidade.
          </p>
        </div>
      </section>
    </div>
  );
}
