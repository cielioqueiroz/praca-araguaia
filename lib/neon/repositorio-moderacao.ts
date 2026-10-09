import { obterPool } from '@/lib/neon/cliente';
import type { Decisao } from '@/lib/moderacao-tipos';
import type { DecisaoFornecedor } from '@/lib/fornecedores';
import type { ReporteValido } from '@/lib/termometro';

export function repositorioModeracaoNeon() {
  return {
    async decidirReporte(id: string, decisao: Decisao): Promise<boolean> {
      const resultado = await obterPool(true).query(
        `update reportes set status = $2 where id = $1 and status = 'pendente'`,
        [id, decisao],
      );
      return resultado.rowCount === 1;
    },

    async decidirFornecedor(id: string, decisao: DecisaoFornecedor): Promise<boolean> {
      const origem = decisao === 'removido' ? 'aprovado' : 'pendente';
      const resultado = await obterPool(true).query(
        `update fornecedores set status = $2 where id = $1 and status = $3`,
        [id, decisao, origem],
      );
      return resultado.rowCount === 1;
    },

    async registrarReporteDaPraca(reporte: ReporteValido): Promise<void> {
      await obterPool(true).query(
        `insert into reportes (produto, municipio, valor, status, origem)
         values ($1, $2, $3, 'aprovado', 'praca')`,
        [reporte.produto, reporte.municipio, reporte.valor],
      );
    },
  };
}
