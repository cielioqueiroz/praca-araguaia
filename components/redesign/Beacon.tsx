'use client';

import { useEffect } from 'react';

// Avisa ao servidor que houve um acesso, para o painel de audiência contar por
// cidade. Não manda nada: quem resolve a cidade é o header de geo da Vercel, no
// servidor. Aqui só o disparo.

const MARCA = 'praca-visita-contada';

export function Beacon() {
  useEffect(() => {
    // Uma vez por sessão do navegador: sem isto, navegar entre 6 páginas contaria
    // 6 acessos e o painel diria que a praça tem 6x o movimento que tem.
    if (sessionStorage.getItem(MARCA)) return;
    sessionStorage.setItem(MARCA, '1');

    // keepalive: o disparo sobrevive se a pessoa sair da página no mesmo instante.
    // Falhar não faz nada — é contagem, não é o site.
    void fetch('/api/visita', { method: 'POST', keepalive: true }).catch(() => {});
  }, []);

  return null;
}
