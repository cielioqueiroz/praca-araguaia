import { describe, it, expect } from 'vitest';
import { legendaBoletim, urlFotoBoletim } from '@/lib/telegram-boletim';

const AGORA = new Date('2026-07-05T13:00:00Z'); // 10:00 em America/Araguaina

describe('legendaBoletim', () => {
  it('traz a data em extenso e o link do painel', () => {
    const l = legendaBoletim(AGORA);
    expect(l).toContain('5 de julho');
    expect(l).toContain('agroapp-bay.vercel.app');
    expect(l).toContain('Bom dia');
  });

  it('credita o criador', () => {
    expect(legendaBoletim(AGORA)).toContain('Cielio Queiroz');
  });
});

describe('urlFotoBoletim', () => {
  it('aponta pro boletim com a data local', () => {
    expect(urlFotoBoletim(AGORA)).toContain('https://agroapp-bay.vercel.app/api/boletim?d=2026-07-05');
  });

  it('usa a data no fuso America/Araguaina, não UTC', () => {
    // 01:00 UTC ainda é 04/07 22:00 no Araguaia (-03:00)
    expect(urlFotoBoletim(new Date('2026-07-05T01:00:00Z'))).toContain('?d=2026-07-04');
  });

  // O Telegram cacheia foto remota por URL: sem isto, um reenvio no mesmo dia
  // devolvia o card antigo que ele já tinha baixado.
  it('a URL muda a cada envio, para o Telegram não servir o card do cache', () => {
    const a = urlFotoBoletim(new Date('2026-07-05T13:00:00Z'));
    const b = urlFotoBoletim(new Date('2026-07-05T13:05:00Z'));
    expect(a).not.toBe(b);
    expect(a).toMatch(/&t=\d+$/);
  });
});
