import type { DiaDaRegiao } from '@/lib/chuva-resumo';
import { CHUVA_MIN_MM } from '@/lib/chuva-resumo';

// A SEMANA EM UMA LINHA — sete colunas, uma por dia, para o olho achar a chuva sem
// ler cinco tabelas. É a resposta à pergunta "quando chove?", que era a que a
// página não respondia: ela listava 35 linhas de igual peso e deixava a conta para
// o leitor.
//
// A coluna do dia seco é um traço fino e apagado; a do dia de chuva cresce e ganha
// cor. A diferença de peso é o dado.

const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'UTC' });
const emUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

// A ESCALA É A DA PRÓPRIA SEMANA, não uma régua fixa.
//
// Com um teto fixo de 25 mm, uma semana de 0,2 mm virava sete cotocos de 1 px: a
// faixa não mostrava nada, nem mesmo QUAL dia era o mais molhado — que é a sua
// única função. Escalando pelo maior dia, a FORMA da semana aparece sempre.
//
// O risco disso é o leitor achar que a barra cheia significa muita chuva. Por isso
// a legenda ao lado sempre diz a que o topo corresponde ("escala: até 0,2 mm"), e
// os milímetros vão escritos em cada coluna. A altura mostra a forma; o número, o
// tamanho.
// O piso só existe para não dividir por zero numa semana totalmente seca; fora
// disso a escala é o maior dia, e a coluna dele encosta no topo.
const PISO_ESCALA_MM = 0.1;

export function FaixaSemana({
  dias,
  municipios,
  maiorDiaMm,
}: {
  dias: DiaDaRegiao[];
  municipios: number;
  maiorDiaMm: number;
}) {
  if (dias.length === 0) return null;
  const escala = Math.max(maiorDiaMm, PISO_ESCALA_MM);

  return (
    <div className="fsemana" role="list">
      {dias.map((d, i) => {
        const chove = d.chuvaMm >= CHUVA_MIN_MM;
        const altura = chove ? Math.max(10, Math.min(100, (d.chuvaMm / escala) * 100)) : 0;
        const data = emUtc(d.data);

        return (
          <div
            key={d.data}
            role="listitem"
            className={`fdia${chove ? ' molhado' : ''}`}
          >
            <div className="fcol" aria-hidden="true">
              {/* A altura vai por variável CSS para o anime.js poder animá-la sem
                  reescrever o estilo inteiro do elemento. */}
              <span className="fbarra" data-barra="y" style={{ ['--alt' as string]: `${altura}%` }} />
            </div>

            <div className="fmm">
              {chove ? (
                <>
                  {d.chuvaMm.toLocaleString('pt-BR')}
                  <i>mm</i>
                </>
              ) : (
                <span className="fseco">—</span>
              )}
            </div>

            <div className="fdata">
              {/* O primeiro dia da previsão é hoje. Escrever "hoje" ancora a
                  semana melhor do que um destaque de cor, que o leitor tem de
                  decifrar. */}
              <b>{i === 0 ? 'hoje' : fmtDiaSemana.format(data).replace('.', '')}</b>
              <span>{fmtDiaMes.format(data)}</span>
            </div>

            {/* Quantos dos municípios pegam chuva neste dia: um "3 de 5" diz se a
                chuva é geral ou é só numa ponta da praça. */}
            <div className="fquantos">
              {chove ? `${d.municipiosComChuva} de ${municipios}` : ' '}
            </div>
          </div>
        );
      })}
    </div>
  );
}
