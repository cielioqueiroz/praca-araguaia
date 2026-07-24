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

  // Duas entregas por dia (23/07/2026). Sem distinguir as duas, o segundo card
  // chegaria como uma repetição do primeiro — e card repetido foi justamente o
  // que fez o dono achar que o sistema tinha congelado.
  it('a abertura diz que o preço é o fechamento de ontem', () => {
    const l = legendaBoletim(AGORA, 'abertura');
    expect(l).toContain('Bom dia');
    expect(l).toContain('abre');
    expect(l).toContain('fechamento de ontem');
  });

  it('o fechamento diz que o pregão encerrou e o preço é de hoje', () => {
    const l = legendaBoletim(AGORA, 'fechamento');
    expect(l).toContain('fechamento do dia');
    expect(l).toContain('apurados hoje');
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
    expect(urlFotoBoletim(AGORA, SEGREDO)).toMatch(/&t=\d+&s=[0-9a-f]{32}$/);
  });
});
