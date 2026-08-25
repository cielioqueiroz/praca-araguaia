'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tempoRelativo } from '@/lib/tempo';
import type { Categoria, Noticia } from '@/types/noticia';

type Filtro = Categoria | 'tudo' | 'internacional';

const CHIPS: Array<{ id: Filtro; rotulo: string }> = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'pecuaria', rotulo: 'Pecuária' },
  { id: 'graos', rotulo: 'Grãos' },
  { id: 'mercado', rotulo: 'Mercado' },
  { id: 'clima', rotulo: 'Clima' },
  { id: 'internacional', rotulo: 'Internacional' },
  { id: 'geral', rotulo: 'Geral' },
];

// A ordem das seções é a ordem de interesse de quem vive da porteira: primeiro o
// bicho, depois o grão, depois o dinheiro. Não é alfabética nem a ordem do feed.
const SECOES: Array<{ id: Categoria; titulo: string; meta: string }> = [
  { id: 'pecuaria', titulo: 'Pecuária', meta: 'Boi, vaca, bezerro e frigorífico' },
  { id: 'graos', titulo: 'Grãos', meta: 'Soja, milho e safra' },
  { id: 'mercado', titulo: 'Mercado', meta: 'Câmbio, ouro, bolsa e comércio' },
  { id: 'clima', titulo: 'Clima', meta: 'Chuva, seca e previsão' },
  { id: 'geral', titulo: 'Geral', meta: 'O resto do agro' },
];

const INTERVALO_REFRESH_MS = 15 * 60 * 1000;

function Selo({ veiculo }: { veiculo: string }) {
  return (
    <div className="nsemfoto" aria-hidden="true">
      <span>{veiculo.slice(0, 1)}</span>
    </div>
  );
}

function Foto({ noticia }: { noticia: Noticia }) {
  const [quebrou, setQuebrou] = useState(false);
  if (!noticia.imagem || quebrou) return <Selo veiculo={noticia.veiculo} />;
  return (
    // Foto do veículo, servida pelo domínio dele: sem next/image, que exigiria
    // liberar dezenas de domínios remotos. Se o veículo bloquear o hotlink, o
    // onError troca pelo selo em vez de deixar o ícone de imagem quebrada.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={noticia.imagem} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setQuebrou(true)} />
  );
}

function Cartao({ noticia, agora, destaque = false }: { noticia: Noticia; agora: number; destaque?: boolean }) {
  return (
    <a className={destaque ? 'ndestaque' : 'ncard'} href={noticia.link} target="_blank" rel="noopener noreferrer">
      <div className="nfoto">
        <Foto noticia={noticia} />
        {noticia.internacional && <span className="nfora">Internacional</span>}
      </div>
      <div className="ncorpo">
        <div className="nveiculo">{noticia.veiculo}</div>
        <h3 className="ntitulo">{noticia.titulo}</h3>
        {destaque && noticia.resumo && <p className="nresumo">{noticia.resumo}</p>}
        <div className="nquando">{noticia.publicadoEm ? tempoRelativo(noticia.publicadoEm, agora) : 'recente'}</div>
      </div>
    </a>
  );
}

/** O mesmo divisor das seções do painel — o site já fala assim. */
function Divisor({ titulo, meta, n }: { titulo: string; meta: string; n: number }) {
  return (
    <div className="section-head nsechead">
      <div className="t">{titulo}</div>
      <div className="line" />
      <div className="meta">
        {meta}
        <span className="pill">{n}</span>
      </div>
    </div>
  );
}

export function GradeNoticias({ noticias }: { noticias: Noticia[] }) {
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const router = useRouter();

  // O "há 2 h" nasce do relógio do servidor e passa a ser o do navegador. Fixar o
  // agora só depois da montagem evita o erro de hidratação quando os dois discordam.
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => setAgora(Date.now()), [noticias]);

  // Recarrega sozinho sem recarregar a página: router.refresh() troca o conteúdo
  // mantendo a rolagem e o filtro. Um location.reload() jogaria quem está lendo de
  // volta ao topo a cada 15 minutos.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, INTERVALO_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router]);

  const visiveis = useMemo(() => {
    if (filtro === 'tudo') return noticias;
    if (filtro === 'internacional') return noticias.filter((n) => n.internacional);
    return noticias.filter((n) => n.categoria === filtro);
  }, [noticias, filtro]);

  // Chip que abre uma lista vazia é armadilha: só mostra o que tem notícia.
  const chips = useMemo(() => {
    const cats = new Set(noticias.map((n) => n.categoria));
    const temFora = noticias.some((n) => n.internacional);
    return CHIPS.filter((c) =>
      c.id === 'tudo' ? true : c.id === 'internacional' ? temFora : cats.has(c.id),
    );
  }, [noticias]);

  const quando = agora ?? Date.now();
  const [destaque, ...resto] = visiveis;

  // Com filtro ligado, a lista é uma só — separar em seções repetiria o próprio
  // filtro como título. Sem filtro, as seções são o mapa da página.
  const seccionado = filtro === 'tudo';
  const porSecao = useMemo(() => {
    const mapa = new Map<Categoria, Noticia[]>();
    for (const n of resto) {
      const arr = mapa.get(n.categoria) ?? [];
      arr.push(n);
      mapa.set(n.categoria, arr);
    }
    return mapa;
  }, [resto]);

  return (
    <>
      <div className="nchips" role="tablist" aria-label="Filtrar notícias">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filtro === c.id}
            className={filtro === c.id ? 'nchip ativo' : 'nchip'}
            onClick={() => setFiltro(c.id)}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="mono nvazio">Nenhuma notícia neste assunto agora.</p>
      ) : (
        <>
          <Cartao noticia={destaque} agora={quando} destaque />

          {seccionado
            ? SECOES.map(({ id, titulo, meta }) => {
                const itens = porSecao.get(id) ?? [];
                if (itens.length === 0) return null; // seção vazia não vira título solto
                return (
                  <section key={id} className="nsec">
                    <Divisor titulo={titulo} meta={meta} n={itens.length} />
                    <div className="ngrade">
                      {itens.map((n) => (
                        <Cartao key={n.id} noticia={n} agora={quando} />
                      ))}
                    </div>
                  </section>
                );
              })
            : resto.length > 0 && (
                <div className="ngrade nsec">
                  {resto.map((n) => (
                    <Cartao key={n.id} noticia={n} agora={quando} />
                  ))}
                </div>
              )}
        </>
      )}
    </>
  );
}
