'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tempoRelativo } from '@/lib/tempo';
import type { Categoria, Noticia } from '@/types/noticia';

const CHIPS: Array<{ id: Categoria | 'tudo'; rotulo: string }> = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'pecuaria', rotulo: 'Pecuária' },
  { id: 'graos', rotulo: 'Grãos' },
  { id: 'mercado', rotulo: 'Mercado' },
  { id: 'clima', rotulo: 'Clima' },
  { id: 'geral', rotulo: 'Geral' },
];

// A cada 15 min a página busca notícia nova sozinha.
const INTERVALO_REFRESH_MS = 15 * 60 * 1000;

/** Inicial do veículo, para quando a matéria não traz foto. */
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
    <a
      className={destaque ? 'ndestaque' : 'ncard'}
      href={noticia.link}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="nfoto">
        <Foto noticia={noticia} />
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

export function GradeNoticias({ noticias }: { noticias: Noticia[] }) {
  const [filtro, setFiltro] = useState<Categoria | 'tudo'>('tudo');
  const router = useRouter();

  // O "há 2 h" é calculado com a hora do relógio do servidor na primeira pintura e
  // com a do navegador depois. Fixar o agora só depois da montagem evita o erro de
  // hidratação que apareceria quando os dois relógios discordam por segundos.
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => setAgora(Date.now()), [noticias]);

  // Recarrega as notícias sozinho, sem recarregar a página: router.refresh() troca
  // o conteúdo mantendo a rolagem e o filtro escolhido. Um location.reload() jogaria
  // quem está lendo de volta para o topo a cada 15 minutos.
  useEffect(() => {
    const tick = () => {
      // Aba em segundo plano não precisa de notícia fresca; ela atualiza quando voltar.
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, INTERVALO_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router]);

  const visiveis = useMemo(
    () => (filtro === 'tudo' ? noticias : noticias.filter((n) => n.categoria === filtro)),
    [noticias, filtro],
  );

  // Só mostra o chip que tem notícia: chip que abre uma lista vazia é armadilha.
  const chips = useMemo(() => {
    const existentes = new Set(noticias.map((n) => n.categoria));
    return CHIPS.filter((c) => c.id === 'tudo' || existentes.has(c.id));
  }, [noticias]);

  const [destaque, ...resto] = visiveis;
  const quando = agora ?? Date.now();

  return (
    <>
      <div className="nchips" role="tablist" aria-label="Filtrar por assunto">
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
          {resto.length > 0 && (
            <div className="ngrade">
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
