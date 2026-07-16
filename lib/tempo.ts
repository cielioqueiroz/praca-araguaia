// Tempo em palavras, para o leitor. Puro e sem node:*, então serve ao servidor e ao
// navegador igualmente.
//
// Nasceu na moderação e agora as notícias usam também ("há 2 h" em cada card), então
// saiu de lib/moderacao-tipos.ts para cá — uma página de notícias não deve importar
// nada chamado "moderação" para formatar uma data. O módulo antigo reexporta esta
// função, de modo que quem já importava de lá continua funcionando.

export function tempoRelativo(iso: string, agora: number): string {
  const minutos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
