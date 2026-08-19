import { Fragment } from 'react';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { faixasDaPorteira, type PrecoDeLugar } from '@/lib/faixa-porteira';
import { PAGINAS_PRACA } from '@/lib/pracas-paginas';
import { IconeCommodity } from './iconesCommodity';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * O preço abrindo a home.
 *
 * Quem chega de um link do WhatsApp caía numa grade de notícias agregadas — a única
 * coisa do site que qualquer portal também tem — enquanto o preço da praça, que é a
 * promessa do projeto, ficava a um clique. Esta faixa põe o número primeiro.
 *
 * É uma TABELA, não seis cartões. Como cartão, cada um tinha a própria caixa e o
 * conteúdo mais longo (a faixa da reposição, "2.788,00–3.178,00") quebrava em duas
 * linhas só nele: os seis saíam com alturas e rodapés diferentes, e mexer em fonte ou
 * em ponto de quebra só mudava QUAL deles quebrava. Aqui as colunas são `max-content`
 * — nascem do maior valor de cada coluna —, então nada quebra em lugar nenhum e as
 * linhas ficam alinhadas por construção, não por sorte.
 *
 * Sem média: o valor é a FAIXA entre os lugares, e a legenda diz em quantos. Média foi
 * removida da interface na fatia 15 e não volta pela porta dos fundos.
 */
export async function PracaHoje() {
  const supabase = createPublicClient();
  const [{ data: pracas }, { data: ufs }] = await Promise.all([
    supabase.from('cotacoes_praca').select('tipo, valor'),
    supabase.from('cotacoes_uf').select('tipo, valor'),
  ]);

  // Boi e vaca vêm por praça; o resto, por estado. Um produto nunca mistura os dois:
  // se há praça, ela manda — é o mesmo critério do painel e do card do boletim.
  const doPraca = ((pracas ?? []) as PrecoDeLugar[]).map((p) => ({ tipo: p.tipo, valor: Number(p.valor) }));
  const tiposComPraca = new Set(doPraca.map((p) => p.tipo));
  const doUf = ((ufs ?? []) as PrecoDeLugar[])
    .filter((p) => !tiposComPraca.has(p.tipo))
    .map((p) => ({ tipo: p.tipo, valor: Number(p.valor) }));

  const faixas = faixasDaPorteira([...doPraca, ...doUf]);
  if (faixas.length === 0) return null;

  return (
    <section className="section phoje">
      <div className="section-head">
        <div className="t">A praça hoje</div>
        <div className="line" />
        <div className="meta">
          <Link href="/cotacoes" className="phlink">
            Ver a praça inteira →
          </Link>
        </div>
      </div>

      <div className="ptabela">
        {faixas.map((f) => (
          <Fragment key={f.tipo}>
            <span className="p-nome">
              <IconeCommodity tipo={f.tipo} className="p-ic" />
              <Link href={`/cotacao/${f.tipo}`}>{f.rotulo}</Link>
              <i>{f.unidadeCurta}</i>
            </span>
            <span className="p-faixa tnum">
              {f.min === f.max ? (
                fmt.format(f.min)
              ) : (
                <>
                  {fmt.format(f.min)}
                  <i>–</i>
                  {fmt.format(f.max)}
                </>
              )}
            </span>
            <span className="p-lug mono">{f.lugares === 1 ? '1 lugar' : `${f.lugares} lugares`}</span>
          </Fragment>
        ))}
      </div>

      <nav className="phpracas" aria-label="Praças">
        <span className="mono">Sua cidade:</span>
        {PAGINAS_PRACA.map((p) => (
          <Link key={p.slug} href={`/praca/${p.slug}`}>
            {p.nome}
          </Link>
        ))}
      </nav>
    </section>
  );
}
