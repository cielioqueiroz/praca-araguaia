// POR QUE ISTO EXISTE: uma fonte que mantém a conexão aberta prende a coleta
// inteira até o limite da função. As leituras são paralelas; 12 segundos dão
// chance ao serviço lento sem impedir o resultado das outras fontes.
export const PRAZO_FONTE_MS = 12_000;

export function requisicaoFonte(
  fetchImpl: typeof fetch,
  url: RequestInfo | URL,
  opcoes: RequestInit = {},
): Promise<Response> {
  return fetchImpl(url, { ...opcoes, signal: AbortSignal.timeout(PRAZO_FONTE_MS) });
}
