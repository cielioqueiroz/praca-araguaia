import type { IconType } from 'react-icons';
import { LuSun, LuCloudSun, LuCloudDrizzle, LuCloudRain, LuCloudRainWind } from 'react-icons/lu';
import type { PrevisaoMunicipio } from '@/lib/fontes/chuva';

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
const CHUVA_MIN_MM = 0.1; // abaixo disso o dia é seco
const BARRA_MAX_MM = 30; // teto visual da barra

// O ícone conta a mesma história que o número: seco, ameaça, garoa, chuva, aguaceiro.
function iconeDoDia(chuvaMm: number, probMax: number | null): { Icone: IconType; rotulo: string } {
  if (chuvaMm >= CHUVA_FORTE_MM) return { Icone: LuCloudRainWind, rotulo: 'chuva forte' };
  if (chuvaMm >= 2) return { Icone: LuCloudRain, rotulo: 'chuva' };
  if (chuvaMm >= CHUVA_MIN_MM) return { Icone: LuCloudDrizzle, rotulo: 'garoa' };
  if ((probMax ?? 0) >= 30) return { Icone: LuCloudSun, rotulo: 'pode chover' };
  return { Icone: LuSun, rotulo: 'sem chuva' };
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
            <b>{(Math.round(totalMm * 10) / 10).toLocaleString('pt-BR')}</b> <i>mm em 7 dias</i>
          </>
        ) : (
          <i className="seco">sem chuva nos 7 dias</i>
        )}
      </div>

      <ul className="chdias" data-grupo-barras>
        {previsao.dias.map((dia) => {
          const forte = dia.chuvaMm >= CHUVA_FORTE_MM;
          const chove = dia.chuvaMm >= CHUVA_MIN_MM;
          const larg = chove ? Math.max(7, Math.min(100, (dia.chuvaMm / BARRA_MAX_MM) * 100)) : 0;
          const { Icone, rotulo } = iconeDoDia(dia.chuvaMm, dia.probMax);
          const temProb = dia.probMax !== null && dia.probMax > 0;

          return (
            <li key={dia.data} className={chove ? (forte ? 'molhado forte' : 'molhado') : 'seco'}>
              <span className="chdia">{diaCurto(dia.data)}</span>

              <Icone role="img" aria-label={rotulo} className="chicone" />

              <span className="chtrilho" aria-hidden="true">
                {chove && <span className="chbarra" data-barra="x" style={{ ['--larg' as string]: `${larg}%` }} />}
              </span>

              {/* Dia seco não repete "0 mm" e "0%": vira traço, e o olho vai direto no que chove. */}
              <span className="chmm">{chove ? `${dia.chuvaMm.toLocaleString('pt-BR')} mm` : '—'}</span>

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
