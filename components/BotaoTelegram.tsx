'use client';

import { useEffect, useState } from 'react';
import { linkTelegram } from '@/lib/audiencia';

function IconeTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

/**
 * Botão de inscrição no bot, levando junto a cidade de quem clicou.
 *
 * O Telegram não informa a cidade do inscrito — só um chat_id. Então a cidade é
 * capturada aqui, no clique, e viaja na carga do link (t.me/bot?start=...). O
 * /start decodifica e guarda cidade/UF junto do chat_id.
 *
 * É client, e não server, de propósito: ler headers() no rodapé tornaria o layout
 * inteiro dinâmico e mataria o ISR da home de notícias. Enquanto a cidade não
 * resolve — ou se nunca resolver — o link limpo já está lá e inscreve igual: a
 * cidade é um bônus para o painel, nunca um pré-requisito da inscrição.
 */
export function BotaoTelegram({ className }: { className?: string }) {
  const [href, setHref] = useState(linkTelegram());

  useEffect(() => {
    const usar = (cidade?: string, uf?: string) => {
      if (cidade && uf) setHref(linkTelegram(cidade, uf));
    };

    // Mesma chave que a barra do topo e o LocalUsuario já preenchem.
    const salvo = localStorage.getItem('praca-loc');
    if (salvo) {
      try {
        const s = JSON.parse(salvo) as { cidade?: string; uf?: string };
        usar(s.cidade, s.uf);
        return;
      } catch {
        /* cache podre: busca de novo */
      }
    }

    fetch('/api/geo')
      .then((r) => r.json())
      .then((d: { cidade?: string; uf?: string }) => usar(d.cidade, d.uf))
      .catch(() => {});
  }, []);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <IconeTelegram className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5" />
      Boletim no Telegram
    </a>
  );
}
