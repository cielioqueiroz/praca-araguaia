'use client';

import { linkWhatsApp, convite, type AlvoCompartilhamento } from '@/lib/compartilhar';

function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.86 9.86 0 004.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.05-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.41 5.82c0 4.54-3.7 8.23-8.23 8.23z" />
    </svg>
  );
}

/**
 * Mandar a praça para alguém.
 *
 * É um LINK do `wa.me`, não um botão de JavaScript: funciona sem script, no
 * navegador velho do celular e no desktop (web.whatsapp). Onde o aparelho tem folha
 * de compartilhamento nativa (quase todo celular), o clique é interceptado e abre a
 * folha — que também oferece WhatsApp, mas deixa mandar por SMS, e-mail ou copiar.
 *
 * Cancelar a folha não é erro: a pessoa desistiu, e nada mais acontece.
 */
export function BotaoCompartilhar({
  alvo,
  className,
  rotulo = 'Mandar no WhatsApp',
}: {
  alvo: AlvoCompartilhamento;
  className?: string;
  rotulo?: string;
}) {
  const href = linkWhatsApp(alvo);

  async function aoClicar(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof navigator === 'undefined' || !navigator.share) return; // segue o link
    e.preventDefault();
    const c = convite(alvo);
    try {
      await navigator.share({ title: c.titulo, text: c.texto, url: c.url });
    } catch (err) {
      // Desistiu: não abre nada. Qualquer outra falha cai no WhatsApp, que é o destino
      // que o link já prometia.
      if ((err as Error)?.name !== 'AbortError') window.open(href, '_blank', 'noopener');
    }
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={aoClicar} className={className}>
      <IconeWhatsApp className="h-[18px] w-[18px]" />
      {rotulo}
    </a>
  );
}
