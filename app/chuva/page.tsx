import Link from 'next/link';
import { buscarPrevisao, MUNICIPIOS, type PrevisaoMunicipio } from '@/lib/fontes/chuva';
import { resumirChuva } from '@/lib/chuva-resumo';
import { CardChuva } from '@/components/CardChuva';
import { SuaRegiaoChuva } from '@/components/redesign/SuaRegiaoChuva';
import { FaixaSemana } from '@/components/redesign/FaixaSemana';
import { AnimarBarrasChuva } from '@/components/redesign/AnimarBarrasChuva';

export const metadata = {
  title: 'Chuva na região',
  description:
    'Quanto vai chover no Vale do Araguaia nos próximos 7 dias: o total da região, o dia em que a chuva chega e a previsão de cada município da praça.',
};

// Dinâmica de propósito: o fetch da Open-Meteo continua cacheado por 1h (data cache),
// mas uma FALHA não fica congelada na página estática — a próxima visita tenta de novo
// e a página se recupera assim que a API voltar (falha de fetch não entra no cache).
export const dynamic = 'force-dynamic';

const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Araguaina' });
const emUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

export default async function Chuva() {
  let previsoes: PrevisaoMunicipio[] | null;
  try {
    previsoes = await buscarPrevisao();
  } catch (erro) {
    console.error('Previsão indisponível (Open-Meteo):', erro);
    previsoes = null;
  }

  // SEM DADO NÃO É "SEM CHUVA". A primeira versão desta página montava a manchete
  // a partir do resumo de uma lista vazia — então, com a Open-Meteo fora do ar, o
  // hero anunciava "Sem chuva à vista" e o pluviômetro marcava 0,0 mm. Isso é
  // afirmar que não vai chover sem ter olhado: o mesmo pecado do preço inventado.
  // Falha de fonte tem manchete própria.
  const semDados = previsoes === null;

  const resumo = resumirChuva(previsoes ?? []);
  const chegada = resumo.primeiroDiaRelevante;

  // A MANCHETE SAI DO DADO, e é isso que faz a página valer a visita: em julho, no
  // seco do Araguaia, ela diz "sem chuva à vista" — e essa é a informação. Quando
  // as águas chegam, ela diz que dia. Um título fixo ("Chuva na região") obrigava o
  // produtor a ler cinco tabelas para saber o que o título já podia ter dito.
  //
  // O gatilho é o dia RELEVANTE (≥ 1 mm), não qualquer chuva: anunciar a chegada da
  // chuva em cima de 0,2 mm mandava o produtor à tabela para não achar chuva
  // nenhuma. O total continua escrito no lede, com a garoa e tudo.
  const manchete = semDados ? (
    <>
      Previsão
      <br />
      <em>indisponível</em>.
    </>
  ) : chegada ? (
    <>
      A chuva chega
      <br />
      <em>{fmtDiaLongo.format(emUtc(chegada.data))}</em>.
    </>
  ) : (
    <>
      Sem chuva
      <br />
      <em>à vista</em>.
    </>
  );

  const lede = semDados
    ? 'A Open-Meteo não respondeu agora. A previsão volta sozinha na próxima visita — nada aqui foi estimado.'
    : chegada
      ? `${resumo.totalMm.toLocaleString('pt-BR')} mm previstos para a semana, na média dos municípios da praça.`
      : resumo.semanaSeca
        ? 'Nenhum município da praça tem chuva prevista para os próximos sete dias.'
        : `Só garoa: ${resumo.totalMm.toLocaleString('pt-BR')} mm em sete dias, na média da praça. Nenhum dia passa de 1 mm.`;

  return (
    <div className="wrap">
      <section className="hero chhero">
        <div className="text">
          <div className="kicker">Chuva na região · próximos 7 dias</div>
          <h1>{manchete}</h1>
          <p className="lede">{lede}</p>

          <div className="meta">
            {resumo.diaMaisMolhado && (
              <div className="big">
                Dia mais molhado: {fmtDiaLongo.format(emUtc(resumo.diaMaisMolhado.data))},{' '}
                {fmtDiaMes.format(emUtc(resumo.diaMaisMolhado.data))} —{' '}
                {resumo.diaMaisMolhado.chuvaMm.toLocaleString('pt-BR')} mm.
              </div>
            )}
            <div className="mono">
              {semDados
                ? 'Fonte: Open-Meteo · sem resposta agora'
                : `Atualizado ${fmtHora.format(new Date())} · Open-Meteo · ${MUNICIPIOS.length} municípios`}
            </div>
          </div>
        </div>

        {/* Gado no pasto em dia chuvoso — a chuva no que ela importa aqui: no
            que está no cocho. A leitura da semana vai escrita sobre a foto. */}
        <div className="chfoto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/chuva-pasto.jpg" alt="Gado no pasto sob nuvens de chuva" />
          <div className="chfoto-tinta" />
          <span className="tag">Vale do Araguaia</span>
          <div className="chleitura">
            <b>{semDados ? '—' : resumo.totalMm.toLocaleString('pt-BR')}</b>
            <span>{semDados ? 'sem leitura' : 'mm previstos em 7 dias'}</span>
          </div>
        </div>
      </section>

      {previsoes === null ? (
        <section className="section chvazio">
          <p className="mono">
            A previsão não carregou agora. Ela volta sozinha na próxima visita —{' '}
            <Link href="/cotacoes">veja as cotações de hoje</Link>.
          </p>
        </section>
      ) : (
        <AnimarBarrasChuva>
          {resumo.dias.length > 0 && (
            <section className="chsec">
              <div className="chsechead">
                <h2>A semana</h2>
                <span className="regra" />
                {/* A escala é a da própria semana, então ela precisa estar
                    declarada: sem isto, a barra cheia de uma semana de garoa
                    pareceria a barra cheia de um temporal. */}
                <span className="chlegenda">
                  média dos {MUNICIPIOS.length} municípios · escala até{' '}
                  {Math.max(resumo.maiorDiaMm, 1).toLocaleString('pt-BR')} mm
                </span>
              </div>
              <div data-grupo-barras>
                <FaixaSemana
                  dias={resumo.dias}
                  municipios={MUNICIPIOS.length}
                  maiorDiaMm={resumo.maiorDiaMm}
                />
              </div>
            </section>
          )}

          <SuaRegiaoChuva />

          <section className="chsec">
            <div className="chsechead">
              <h2>Município por município</h2>
              <span className="regra" />
              <span className="chlegenda">chuva · probabilidade · mín/máx</span>
            </div>
            <div className="chgrade">
              {previsoes.map((p) => (
                <CardChuva key={p.municipio} previsao={p} />
              ))}
            </div>
          </section>
        </AnimarBarrasChuva>
      )}
    </div>
  );
}
