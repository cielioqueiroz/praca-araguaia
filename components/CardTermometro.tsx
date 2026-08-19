import type { ResumoProduto } from '@/lib/termometro';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * O cartão do Termômetro, na linguagem editorial do site.
 *
 * Era um cartão de utilitários — tipografia menor, hierarquia diferente do resto —
 * numa página que é o diferencial do produto. Agora usa a mesma gramática dos
 * cartões da porteira: kicker em mono, número grande em sans, pauta de linhas
 * embaixo. O conteúdo e os textos são os mesmos.
 */
export function CardTermometro({ resumo, mediaConab }: { resumo: ResumoProduto; mediaConab?: number }) {
  const mostrarFaixa = resumo.contagem >= 2 && resumo.faixa.min !== resumo.faixa.max;
  return (
    <div className="tcard">
      <div className="ct">{resumo.rotulo}</div>
      <div className="cv tnum">{fmt.format(resumo.mediana)}</div>
      <div className="cu">{resumo.unidade} · valor típico</div>

      <div className="tinfo mono">
        {resumo.contagem} {resumo.contagem === 1 ? 'reporte' : 'reportes'} · últimos 7 dias
      </div>
      {/* De quem é a testemunha do número (ADR 0003) — obrigatória junto do valor. */}
      <div className="tselo">{resumo.procedencia}</div>

      {(mostrarFaixa || mediaConab !== undefined) && (
        <div className="tcontexto">
          {mostrarFaixa && (
            <span>
              faixa: R$ {fmt.format(resumo.faixa.min)}–{fmt.format(resumo.faixa.max)}
            </span>
          )}
          {mediaConab !== undefined && <span>média CONAB: {fmt.format(mediaConab)}</span>}
        </div>
      )}

      {resumo.municipios.length > 0 && (
        <ul className="tcidades">
          {resumo.municipios.map((m) => (
            <li key={m.municipio}>
              <span className="l">{m.municipio}</span>
              <span className="v tnum">{fmt.format(m.mediana)}</span>
              <span className="n mono">({m.contagem})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
