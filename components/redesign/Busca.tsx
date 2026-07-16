'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agruparResultados, buscar, indiceBusca, type ItemBusca } from '@/lib/busca';

function IconeBusca() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

/**
 * A busca do cabeçalho. Antes era um <input> solto, sem estado nem submit: digitar
 * nele não fazia nada. Agora acha produto, cidade e página, e o Enter navega.
 *
 * Tudo no cliente, sobre um índice pequeno — sem rota, sem banco e sem espera.
 */
/**
 * @param naGaveta  instância do menu mobile (a do cabeçalho é a padrão)
 * @param alcancavel  a instância está visível e pode receber foco. A gaveta existe
 *   no DOM mesmo fechada: sem isto, o Tab do teclado no desktop cairia num campo
 *   invisível atrás do menu.
 */
export function Busca({ naGaveta = false, alcancavel = true }: { naGaveta?: boolean; alcancavel?: boolean }) {
  const [consulta, setConsulta] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // As duas instâncias (cabeçalho e gaveta) convivem no DOM. Sem id próprio, as
  // duas teriam id="busca-resultados": HTML inválido, e o aria-controls do leitor
  // de tela apontaria para a caixa errada.
  const idBase = useId();
  const idLista = `busca-lista-${idBase}`;

  const indice = useMemo(() => indiceBusca(), []);
  const resultados = useMemo(() => buscar(indice, consulta), [indice, consulta]);
  const grupos = useMemo(() => agruparResultados(resultados), [resultados]);

  // Nova consulta recomeça a seleção no primeiro: o Enter tem de escolher o mais
  // relevante, não o que sobrou da digitação anterior.
  useEffect(() => setAtivo(0), [consulta]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  // '/' foca a busca, como em todo lugar que tem busca — menos quando a pessoa já
  // está escrevendo em outro campo (senão não dá para digitar barra em lugar nenhum).
  //
  // Só a instância do cabeçalho ouve: se as duas ouvissem, o '/' focaria também o
  // campo da gaveta fechada e o foco sumiria da tela.
  useEffect(() => {
    if (naGaveta) return;
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA';
      if (e.key === '/' && !digitando) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [naGaveta]);

  // Gaveta fechada: some com a lista aberta, senão ela volta pendurada na próxima
  // vez que o menu abrir.
  useEffect(() => {
    if (!alcancavel) setAberto(false);
  }, [alcancavel]);

  const ir = (item: ItemBusca) => {
    setAberto(false);
    setConsulta('');
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAberto(false);
      campo.current?.blur();
      return;
    }
    if (resultados.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i + 1) % resultados.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ir(resultados[ativo]);
    }
  };

  const mostrar = aberto && alcancavel && consulta.trim().length > 0;
  const idOpcao = (i: number) => `${idBase}-opcao-${i}`;
  const idAtivo = resultados[ativo] ? idOpcao(ativo) : undefined;

  return (
    <div className={`search-wrap${naGaveta ? ' na-gaveta' : ''}`} ref={caixa}>
      <div className="search">
        <IconeBusca />
        <input
          ref={campo}
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar praça, produto…"
          aria-label="Buscar praça, produto ou página"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={idLista}
          aria-activedescendant={mostrar ? idAtivo : undefined}
          aria-autocomplete="list"
          tabIndex={alcancavel ? 0 : -1}
        />
      </div>

      {mostrar && (
        <div className="search-pop" id={idLista} role="listbox">
          {resultados.length === 0 ? (
            <div className="search-vazio">Nada encontrado para “{consulta}”.</div>
          ) : (
            grupos.map(({ grupo, itens }) => (
              <div className="search-grupo" key={grupo}>
                <div className="search-gtit">{grupo}</div>
                {itens.map((item) => {
                  const i = resultados.indexOf(item);
                  return (
                    <button
                      key={item.href + item.rotulo}
                      id={idOpcao(i)}
                      type="button"
                      role="option"
                      aria-selected={i === ativo}
                      className={`search-item${i === ativo ? ' ativo' : ''}`}
                      onMouseEnter={() => setAtivo(i)}
                      onClick={() => ir(item)}
                    >
                      <span className="r">{item.rotulo}</span>
                      <span className="s">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
