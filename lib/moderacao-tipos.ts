// Tipos e helpers puros usados também no client (FilaModeracao) — sem node:crypto,
// para não puxar dependências server-only para o bundle do navegador.

// tempoRelativo mudou para lib/tempo.ts quando as notícias passaram a usá-lo; segue
// reexportado aqui para não quebrar quem já o importava daqui ou de lib/moderacao.
export { tempoRelativo } from './tempo';

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

