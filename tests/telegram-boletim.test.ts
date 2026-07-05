import { describe, it, expect } from 'vitest';
import { legendaBoletim, urlFotoBoletim, enviarBoletim } from '@/lib/telegram-boletim';
import type { ResultadoEnvio } from '@/lib/telegram';

const AGORA = new Date('2026-07-05T13:00:00Z'); // 10:00 em America/Araguaina

describe('legendaBoletim', () => {
  it('traz a data em extenso e o link do painel', () => {
    const l = legendaBoletim(AGORA);
    expect(l).toContain('5 de julho');
    expect(l).toContain('agroapp-bay.vercel.app');
    expect(l).toContain('Bom dia');
  });
});

describe('urlFotoBoletim', () => {
  it('aponta pro boletim com cache-buster ?d= na data local', () => {
    expect(urlFotoBoletim(AGORA)).toBe('https://agroapp-bay.vercel.app/api/boletim?d=2026-07-05');
  });

  it('usa a data no fuso America/Araguaina, não UTC', () => {
    // 01:00 UTC ainda é 04/07 22:00 no Araguaia (-03:00)
    expect(urlFotoBoletim(new Date('2026-07-05T01:00:00Z'))).toBe(
      'https://agroapp-bay.vercel.app/api/boletim?d=2026-07-04',
    );
  });
});

describe('enviarBoletim', () => {
  it('acumula enviados, coleta bloqueados (403) e conta falhas', async () => {
    const enviar = async (chatId: number): Promise<ResultadoEnvio> => {
      if (chatId === 2) return { ok: false, bloqueado: true };
      if (chatId === 4) return { ok: false, bloqueado: false };
      return { ok: true };
    };
    const resumo = await enviarBoletim({ chatIds: [1, 2, 3, 4], enviar });
    expect(resumo).toEqual({ enviados: 2, bloqueados: [2], falhas: 1 });
  });

  it('lista vazia devolve tudo zerado', async () => {
    const resumo = await enviarBoletim({ chatIds: [], enviar: async () => ({ ok: true }) });
    expect(resumo).toEqual({ enviados: 0, bloqueados: [], falhas: 0 });
  });

  it('chama enviar uma vez por chatId', async () => {
    const vistos: number[] = [];
    await enviarBoletim({
      chatIds: [10, 20, 30],
      enviar: async (id) => {
        vistos.push(id);
        return { ok: true };
      },
    });
    expect(vistos).toEqual([10, 20, 30]);
  });
});
