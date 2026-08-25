import { BotaoCompartilhar } from './BotaoCompartilhar';
import { BotaoTelegram } from './BotaoTelegram';
import type { AlvoCompartilhamento, TextoConvite } from '@/lib/compartilhar';

/**
 * A faixa do boca a boca.
 *
 * O produto está pronto e vazio: em 18/08/2026 eram 30 acessos e 3 inscritos. O que
 * o site não tinha era um lugar onde passar adiante fosse a ação óbvia — o convite do
 * Telegram morava só no rodapé, e compartilhar não existia. Esta faixa é a resposta,
 * e é de propósito a única coisa dentro dela: dois botões, nada para ler antes.
 *
 * Fica no fim das páginas de conteúdo — depois de a pessoa ter recebido algo de
 * graça, que é a ordem que o conceito §9 pede (dar valor antes de pedir).
 */
export function ConviteDistribuicao({
  alvo,
  personalizado,
  titulo = ['Alguém aí precisa', 'desse preço.'],
  linha = 'Manda no grupo da fazenda, do sindicato, do leilão. É de graça e não pede cadastro de ninguém.',
}: {
  alvo: AlvoCompartilhamento;
  /** Convite montado na hora — a página de praça compartilha a própria cidade. */
  personalizado?: TextoConvite;
  /** Uma entrada por linha da manchete — no celular elas viram uma só. */
  titulo?: string[];
  linha?: string;
}) {
  return (
    <section className="faixa-convite" aria-labelledby="convite-titulo">
      <div className="fc-texto">
        <div className="fc-kicker">Passe adiante</div>
        <h2 id="convite-titulo">
          {/* Cada linha é um span que vira bloco no desktop e volta a ser inline no
              celular — com o espaço final preservado. Com <br> a quebra sumia junto
              com ele na tela pequena e as linhas grudavam: "ConfresaNo grupo certo". */}
          {titulo.map((l) => (
            <span key={l} className="fc-linha">
              {l}{' '}
            </span>
          ))}
        </h2>
        <p className="fc-lede">{linha}</p>
      </div>
      <div className="fc-acoes">
        <BotaoCompartilhar alvo={alvo} personalizado={personalizado} className="fc-btn fc-zap" />
        <BotaoTelegram className="fc-btn fc-tg" />
      </div>
    </section>
  );
}
