import { describe, it, expect, vi, afterEach } from 'vitest';
import { autorizadoPorCron } from '@/lib/cron';

const req = (auth?: string) =>
  new Request('https://praca.exemplo/api/coletar', { headers: auth ? { authorization: auth } : {} });

afterEach(() => vi.unstubAllEnvs());

describe('autorizadoPorCron', () => {
  it('aceita o Bearer com o segredo certo', () => {
    vi.stubEnv('CRON_SECRET', 'segredo');
    expect(autorizadoPorCron(req('Bearer segredo'))).toBe(true);
  });

  it('recusa segredo errado, header ausente e header vazio', () => {
    vi.stubEnv('CRON_SECRET', 'segredo');
    expect(autorizadoPorCron(req('Bearer errado'))).toBe(false);
    expect(autorizadoPorCron(req())).toBe(false);
    expect(autorizadoPorCron(req(''))).toBe(false);
  });

  // O motivo desta função existir. A comparação antiga era com
  // `Bearer ${process.env.CRON_SECRET}`: sem a env, o segredo virava a string
  // "Bearer undefined" e QUALQUER UM disparava o broadcast para os inscritos.
  it('sem CRON_SECRET nega todo mundo — inclusive quem manda "Bearer undefined"', () => {
    vi.stubEnv('CRON_SECRET', '');
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(autorizadoPorCron(req('Bearer undefined'))).toBe(false);
    expect(autorizadoPorCron(req('Bearer '))).toBe(false);
    expect(autorizadoPorCron(req())).toBe(false);
    expect(erro).toHaveBeenCalled(); // o dono precisa achar isso no log

    erro.mockRestore();
  });
});
