import { describe, it, expect } from 'vitest';
import { enviarEmMassa } from '@/lib/telegram-broadcast';
import type { ResultadoEnvio } from '@/lib/telegram';

describe('enviarEmMassa', () => {
  it('acumula enviados, coleta bloqueados (403) e conta falhas', async () => {
    const enviar = async (chatId: number): Promise<ResultadoEnvio> => {
      if (chatId === 2) return { ok: false, bloqueado: true };
      if (chatId === 4) return { ok: false, bloqueado: false };
      return { ok: true };
    };
    const resumo = await enviarEmMassa({ chatIds: [1, 2, 3, 4], enviar });
    expect(resumo).toEqual({ enviados: 2, bloqueados: [2], falhas: 1 });
  });

  it('lista vazia devolve tudo zerado', async () => {
    const resumo = await enviarEmMassa({ chatIds: [], enviar: async () => ({ ok: true }) });
    expect(resumo).toEqual({ enviados: 0, bloqueados: [], falhas: 0 });
  });

  it('chama enviar uma vez por chatId', async () => {
    const vistos: number[] = [];
    await enviarEmMassa({
      chatIds: [10, 20, 30],
      enviar: async (id) => {
        vistos.push(id);
        return { ok: true };
      },
    });
    expect(vistos).toEqual([10, 20, 30]);
  });
});
