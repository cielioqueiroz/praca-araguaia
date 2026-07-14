import Link from 'next/link';
import { IconeCommodity, FOTO_COMMODITY } from './iconesCommodity';
import { NOME_UF } from '@/lib/praca';

export type PrecoUfUI = { uf: string; valor: number; variacaoPct: number | null };
export type PrecoCidadeUI = { municipio: string; uf: string; mediana: number | null; contagem: number };

export type CardPorteiraProps = {
  tipo: string;
  titulo: string;
  unLabel: string; // 'R$ por arroba'
  rodape: string; // 'CONAB · semana de 27/06 a 03/07' ou 'Datagro · 10/07'
  precos: PrecoUfUI[];
  cidades?: PrecoCidadeUI[]; // o que os produtores reportaram nas cidades da praça
};

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function Variacao({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="var-vazia">—</span>;
  const subiu = pct >= 0;
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
          <ul className="ufs">
            {p.precos.map((u) => (
              <li key={u.uf} data-uf={u.uf}>
                <span className="lugar">
                  {NOME_UF[u.uf] ?? u.uf}
                  <b className="badge">sua praça</b>
                </span>
                <span className="valor tnum">{brl(u.valor)}</span>
                <Variacao pct={u.variacaoPct} />
              </li>
            ))}
            {p.precos.length === 0 && <li className="vazio">Sem preço publicado nesta semana.</li>}
          </ul>

          {p.cidades && (
            <div className="cidades">
              <div className="ctit">
                Nas cidades da praça
                <span className="fonte">Termômetro · reportes de produtores</span>
              </div>
              <ul>
                {p.cidades.map((c) => (
                  <li key={c.municipio} data-cidade={c.municipio}>
                    <span className="lugar">
                      {c.municipio}
                      <i>{c.uf}</i>
                      <b className="badge">você</b>
                    </span>
                    {c.mediana === null ? (
                      // Leva o produto do card: o formulário já abre no item certo.
                      <Link className="convite" href={`/termometro/reportar?produto=${p.tipo}`}>
                        seja o primeiro a reportar
                      </Link>
                    ) : (
                      <>
                        <span className="valor tnum">{brl(c.mediana)}</span>
                        <span className="n">
                          {c.contagem} {c.contagem === 1 ? 'reporte' : 'reportes'}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
