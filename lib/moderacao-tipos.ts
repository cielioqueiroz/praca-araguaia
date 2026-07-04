// Tipos e helpers puros usados também no client (FilaModeracao) — sem node:crypto,
// para não puxar dependências server-only para o bundle do navegador.

export type Decisao = 'aprovado' | 'rejeitado';

// Forma que a página /moderar entrega para a FilaModeracao (produto já resolvido).
export type ReportePendente = {
  id: string;
  rotulo: string;
  unidade: string;
  valor: number;
  municipio: string;
  criadoEm: string; // ISO
  mediaConab?: number;
};

export function tempoRelativo(iso: string, agora: number): string {
  const minutos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
