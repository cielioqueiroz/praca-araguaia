import Link from 'next/link';
import { IconeCommodity, FOTO_COMMODITY } from './iconesCommodity';
import { Numero } from './Numero';
import { NOME_UF } from '@/lib/praca';

export type PrecoUfUI = { uf: string; valor: number; variacaoPct: number | null };
export type PrecoCidadeUI = { municipio: string; uf: string; mediana: number | null; contagem: number };
/** Preço de uma praça da Scot: 'Redenção (PA)', com o preço a prazo quando houver. */
export type PrecoPracaUI = { praca: string; uf: string; valor: number; variacaoPct: number | null; valorPrazo?: number };

export type CardPorteiraProps = {
  tipo: string;
  titulo: string;
  unLabel: string; // 'R$ por arroba'
  rodape: string; // 'CONAB · semana de 27/06 a 03/07' ou 'Scot Consultoria · 15/07'
  precos: PrecoUfUI[];
  /** Quando vem preenchido, a lista de cima é por PRAÇA e não por estado (boi, vaca). */
  pracas?: PrecoPracaUI[];
  cidades?: PrecoCidadeUI[]; // o que os produtores reportaram nas cidades da praça
  /**
   * De quem é a testemunha do que está nas cidades (ADR 0003) — 'relatado por
   * produtores', 'apurado pela Praça' ou a conta dos dois. Vem pronto de
   * `procedencia()`; o padrão cobre quem ainda não passa a prop.
   */
  procedenciaCidades?: string;
};

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// 0% não é alta: ganha traço e cor neutra. Enquanto `pct >= 0` mandava, preço
// parado saía com seta verde para cima — uma subida afirmada que não aconteceu.
function Variacao({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="var-vazia">—</span>;
  if (pct === 0) return <span className="var flat"><span className="ar">–</span>0%</span>;
  const subiu = pct > 0;
  return (
    <span className={`var ${subiu ? 'up' : 'down'}`}>
      <span className="ar">{subiu ? '▲' : '▼'}</span>
      {Math.abs(pct).toLocaleString('pt-BR')}%
    </span>
  );
}

// Card da porteira: o preço de CADA estado (nunca uma média) e, embaixo, o que os
// produtores reportaram nas cidades da praça. O destaque da praça do usuário é
// aplicado no cliente (SuaPraca) via data-uf / data-cidade.
export function CardPorteira(p: CardPorteiraProps) {
  const foto = FOTO_COMMODITY[p.tipo];
  // Cidade sem reporte não vira linha: vira o convite único do rodapé.
  const reportadas = (p.cidades ?? []).filter((c) => c.mediana !== null);

  return (
    <article className={`pcard tipo-${p.tipo}`}>
      <div className="ph">
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="art" src={foto} alt="" loading="lazy" />
        )}
        <div className="shade" />
        <div className="cap">
          <IconeCommodity tipo={p.tipo} className="rIcon" />
          <div className="nm">{p.titulo}</div>
        </div>
      </div>

      <div className="pbody">
        <div className="phead">
          <span className="un">{p.unLabel}</span>
          <span className="sem">{p.rodape}</span>
        </div>

        <div className="listas">
          {/* Boi e vaca vêm praça a praça (Scot); o resto, estado a estado. Marcamos
              data-cidade também: 'Redenção' é praça da Scot E cidade da região, então
              o destaque do SuaPraca acerta a linha sem precisar saber disso. */}
          {p.pracas ? (
            <ul className="ufs pracas">
              {p.pracas.map((u, i) => (
                // Só data-cidade: com data-uf, um usuário no Pará acendia "você" em
                // Marabá, Redenção E Paragominas ao mesmo tempo — ninguém está em três
                // praças. A praça é o lugar exato, não o estado.
                <li key={`${u.uf}-${u.praca}`} data-cidade={u.praca}>
                  <span className="lugar">
                    {u.praca}
                    {/* A cidade do Pará ganha a etiqueta da UF ("Marabá [PA]"); a
                        linha que já é o nome do estado, não — "Mato Grosso [MT]"
                        seria redundante. */}
                    {u.praca !== (NOME_UF[u.uf] ?? '') && <i>{u.uf}</i>}
                    <b className="badge">você</b>
                  </span>
                  <Numero className="valor tnum" valor={u.valor} casas={2} atraso={i * 0.05} />
                  <Variacao pct={u.variacaoPct} />
                </li>
              ))}
              {p.pracas.length === 0 && <li className="vazio">Sem preço publicado hoje.</li>}
            </ul>
          ) : (
            <ul className="ufs">
              {p.precos.map((u, i) => (
                <li key={u.uf} data-uf={u.uf}>
                  <span className="lugar">
                    {NOME_UF[u.uf] ?? u.uf}
                    <b className="badge">sua praça</b>
                  </span>
                  <Numero className="valor tnum" valor={u.valor} casas={2} atraso={i * 0.05} />
                  <Variacao pct={u.variacaoPct} />
                </li>
              ))}
              {p.precos.length === 0 && <li className="vazio">Sem preço publicado nesta semana.</li>}
            </ul>
          )}

          {/* Só as cidades que TÊM reporte — o mesmo critério que o card do Telegram
              já usa. Listar as 5 cidades com "seja o primeiro a reportar" em cada um
              dos 6 produtos enchia o painel de 30 linhas vazias, e repetia Redenção,
              que já está na lista da Scot logo acima. Sem reporte nenhum, o convite
              vira UMA linha no rodapé do card. */}
          {reportadas.length > 0 && (
            <div className="cidades">
              <div className="ctit">
                Nas cidades da praça
                <span className="fonte">Termômetro · {p.procedenciaCidades ?? 'relatado por produtores'}</span>
              </div>
              <ul>
                {reportadas.map((c) => (
                  <li key={c.municipio} data-cidade={c.municipio}>
                    <span className="lugar">
                      {c.municipio}
                      <i>{c.uf}</i>
                      <b className="badge">você</b>
                    </span>
                    <span className="valor tnum">{brl(c.mediana as number)}</span>
                    <span className="n">
                      {c.contagem} {c.contagem === 1 ? 'reporte' : 'reportes'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ninguém reportou este produto ainda: uma linha convidando, em vez da
              lista de cidades vazias. O formulário já abre no produto do card. */}
          {p.cidades && reportadas.length === 0 && (
            <Link className="convite-pe" href={`/termometro/reportar?produto=${p.tipo}`}>
              Sabe o preço na sua cidade? Reporte →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
