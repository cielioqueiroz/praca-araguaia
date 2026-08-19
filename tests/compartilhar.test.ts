import { describe, it, expect } from 'vitest';
import { convite, linkWhatsApp, SITE } from '@/lib/compartilhar';

describe('compartilhar', () => {
  it('a mensagem termina no link, para o WhatsApp montar a prévia', () => {
    const c = convite('site');
    expect(c.url).toBe(SITE);
    expect(c.mensagem.endsWith(SITE)).toBe(true);
    expect(c.mensagem).toContain('Vale do Araguaia');
  });

  it('cada alvo leva para a própria página', () => {
    expect(convite('termometro').url).toBe(`${SITE}/termometro`);
    expect(convite('boletim').url).toBe(`${SITE}/boletim`);
    expect(convite('chuva').url).toBe(`${SITE}/chuva`);
    // A home é a raiz: nada de barra sobrando no fim do link.
    expect(convite('site').url).toBe(SITE);
  });

  it('o convite do termômetro pede o reporte — é para lá que falta gente', () => {
    expect(convite('termometro').texto).toMatch(/reporta/i);
  });

  it('o link do WhatsApp vai sem destinatário e com o texto escapado', () => {
    const link = linkWhatsApp('cotacoes');
    // Sem número: o WhatsApp abre a lista de conversas para a pessoa escolher.
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    expect(link).not.toContain(' ');
    expect(decodeURIComponent(link.split('text=')[1])).toBe(convite('cotacoes').mensagem);
  });

  it('aceita outro domínio (prévia/local) sem reescrever texto', () => {
    const c = convite('boletim', 'http://localhost:3000');
    expect(c.url).toBe('http://localhost:3000/boletim');
    expect(c.texto).toBe(convite('boletim').texto);
  });
});
