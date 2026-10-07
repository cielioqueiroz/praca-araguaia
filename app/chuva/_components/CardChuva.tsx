import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';
import { CHUVA_MIN_MM, CHUVA_RELEVANTE_MM } from '@/lib/chuva-resumo';
import { numeroEnxuto } from '@/lib/formato';

// O card de 7 dias de um município.
//
// REESCRITO EM 23/07/2026. Antes ele vivia em utilitários do Tailwind enquanto o
// resto do site fala pelo CSS editorial (papel creme, serifa, mono) — a página de
// chuva era a única órfã, e era por isso que parecia fraca. Agora usa a mesma
// linguagem dos cards da porteira.
//
// A MUDANÇA QUE MAIS IMPORTA é de peso: numa semana seca, 30 das 35 linhas eram um
// traço e uma barra vazia, todas com o mesmo destaque. O dia seco agora RECUA
// (linha fina, tinta apagada, sem barra) e o dia de chuva AVANÇA (barra colorida,
// milímetros em negrito). A diferença de peso é o dado.

// Meio-dia UTC evita a data cair no dia anterior ao formatar (data vem sem hora).
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const diaCurto = (iso: string) => fmtDia.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');

const CHUVA_FORTE_MM = 10;

// O símbolo acompanha a quantidade; 0,1 mm é pingo, não temporal.
function iconeDoDia(chuvaMm: number, probMax: number | null): { simbolo: string; rotulo: string } {
  if (chuvaMm >= CHUVA_FORTE_MM) return { simbolo: '🌧️', rotulo: 'chuva forte prevista' };
  if (chuvaMm >= CHUVA_RELEVANTE_MM) return { simbolo: '🌦️', rotulo: 'chuva prevista' };
  if (chuvaMm >= CHUVA_MIN_MM) return { simbolo: '💧', rotulo: 'pingos previstos' };
  if ((probMax ?? 0) >= 30) return { simbolo: '🌤️', rotulo: 'possibilidade de chuva' };
  return { simbolo: '☀️', rotulo: 'sem chuva prevista' };
}

// `etiqueta` e `tempAtual` só existem no card da região do usuário — que fora isso é
// exatamente este card, para as linhas dos 7 dias serem lidas do mesmo jeito em todos.
export function CardChuva({
  previsao,
  etiqueta,
  tempAtual,
}: {
  previsao: PrevisaoMunicipio;
  etiqueta?: string;
  tempAtual?: number | null;
}) {
  const totalMm = previsao.dias.reduce((s, d) => s + d.chuvaMm, 0);
  const temChuva = totalMm >= CHUVA_MIN_MM;
  const maisMolhado = previsao.dias.reduce<(typeof previsao.dias)[number] | null>(
    (maior, dia) => (!maior || dia.chuvaMm > maior.chuvaMm ? dia : maior), null,
  );
  const escalaMm = Math.max(1, maisMolhado?.chuvaMm ?? 0);
  const chuvaRelevante = maisMolhado !== null && maisMolhado.chuvaMm >= CHUVA_RELEVANTE_MM;
  const destaque = chuvaRelevante && maisMolhado
    ? `Mais água ${diaCurto(maisMolhado.data)}: ${numeroEnxuto(maisMolhado.chuvaMm)} mm`
    : temChuva ? 'Só pingos previstos nesta semana' : 'Semana sem chuva prevista';

  return (
    <article className={`chcard${etiqueta ? ' destaque' : ''}`}>
      <header className="chhead">
        <div className="chnome">
          {etiqueta && <span className="chetiq">{etiqueta}</span>}
          <h3>{previsao.municipio}</h3>
        </div>
        <div className="chmeta">
          {tempAtual != null && <span className="chtemp">{tempAtual}°</span>}
          {previsao.uf && <span className="chuf">{previsao.uf}</span>}
        </div>
      </header>

      {/* O total da semana no cabeçalho do card: quem só quer saber "vai chover em
          Redenção?" para de ler aqui. */}
      <div className="chtotal">
        {temChuva ? (
          <>
            {/* toLocaleString e não o número cru: sem isto saía "1.4 mm" com ponto
                decimal de inglês, no meio de uma página em português. */}
            <b>{numeroEnxuto(Math.round(totalMm * 10) / 10)}</b> <i>mm em 7 dias</i>
          </>
        ) : (
          <i className="seco">sem chuva nos 7 dias</i>
        )}
      </div>

      <div className="chalerta">
        <span aria-hidden="true">{chuvaRelevante ? '💧' : '🌤️'}</span>
        <span>{destaque}</span>
      </div>
      {temChuva && <div className="chescala">Barras proporcionais ao maior dia: {numeroEnxuto(escalaMm)} mm</div>}

      <ul className="chdias" data-grupo-barras>
        {previsao.dias.map((dia) => {
          const forte = dia.chuvaMm >= CHUVA_FORTE_MM;
          const chove = dia.chuvaMm >= CHUVA_MIN_MM;
          const larg = chove ? Math.max(7, Math.min(100, (dia.chuvaMm / escalaMm) * 100)) : 0;
          const { simbolo, rotulo } = iconeDoDia(dia.chuvaMm, dia.probMax);
          const temProb = dia.probMax !== null && dia.probMax > 0;

          return (
            <li key={dia.data} className={chove ? (forte ? 'molhado forte' : 'molhado') : 'seco'}>
              <span className="chdia">{diaCurto(dia.data)}</span>

              <span role="img" aria-label={rotulo} className="chicone">{simbolo}</span>

              <span className="chtrilho" aria-hidden="true">
                {chove && <span className="chbarra" data-barra="x" style={{ ['--larg' as string]: `${larg}%` }} />}
              </span>

              {/* Dia seco não repete "0 mm" e "0%": vira traço, e o olho vai direto no que chove. */}
              <span className="chmm">{chove ? `${numeroEnxuto(dia.chuvaMm)} mm` : '—'}</span>

              <span className="chprob">{temProb ? `${dia.probMax}%` : '—'}</span>

              <span className="chtempo">
                {Math.round(dia.tempMin)}°/{Math.round(dia.tempMax)}°
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
