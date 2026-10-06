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

  // A abertura ainda pode ser usada manualmente; nenhuma sessão promete que a
  // Scot ou a CONAB publicaram dados com a data de hoje.
  it('a abertura informa que cada fonte tem sua própria data', () => {
    const l = legendaBoletim(AGORA, 'abertura');
    expect(l).toContain('Bom dia');
    expect(l).toContain('abre');
    expect(l).toContain('data de cada fonte');
  });

  it('o fechamento informa que a data da apuração está no card', () => {
    const l = legendaBoletim(AGORA, 'fechamento');
    expect(l).toContain('boletim de fechamento');
    expect(l).toContain('data de cada apuração');
    expect(l).not.toContain('Bom dia');
  });

  it('sem sessão, é a abertura — o disparo antigo continua fazendo o de sempre', () => {
    expect(legendaBoletim(AGORA)).toBe(legendaBoletim(AGORA, 'abertura'));
  });
});

describe('urlFotoBoletim', () => {
  const SEGREDO = 'segredo-do-cron';

  it('aponta pro boletim com a data local', () => {
    expect(urlFotoBoletim(AGORA, SEGREDO)).toContain('https://agroapp-bay.vercel.app/api/boletim?d=2026-07-05');
  });

  it('usa a data no fuso America/Araguaina, não UTC', () => {
    // 01:00 UTC ainda é 04/07 22:00 no Araguaia (-03:00)
    expect(urlFotoBoletim(new Date('2026-07-05T01:00:00Z'), SEGREDO)).toContain('?d=2026-07-04');
  });

  // O Telegram cacheia foto remota por URL: sem isto, um reenvio no mesmo dia
  // devolvia o card antigo que ele já tinha baixado.
  it('a URL muda a cada envio, para o Telegram não servir o card do cache', () => {
    const a = urlFotoBoletim(new Date('2026-07-05T13:00:00Z'), SEGREDO);
    const b = urlFotoBoletim(new Date('2026-07-05T13:05:00Z'), SEGREDO);
    expect(a).not.toBe(b);
  });

  // A URL vai assinada: é ela que fura o cache (~8s de função por render), então
  // esse poder é de quem tem o segredo. A rota /api/boletim rejeita query sem `s`.
  it('carrega a assinatura que libera o cache-buster', () => {
    expect(urlFotoBoletim(AGORA, SEGREDO)).toMatch(/&t=\d+&f=telegram&s=[0-9a-f]{32}$/);
  });
});
