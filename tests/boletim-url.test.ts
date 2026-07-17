import { describe, it, expect } from 'vitest';
import { assinarBoletim, boletimLiberado } from '@/lib/boletim-url';

const SEGREDO = 'segredo-do-cron';
const url = (qs: string) => new URL(`https://praca.exemplo/api/boletim${qs}`);

describe('boletimLiberado', () => {
  it('libera a URL sem query — é o card do dia, que o CDN cacheia', () => {
    expect(boletimLiberado(url(''), SEGREDO)).toBe(true);
    expect(boletimLiberado(url('?'), SEGREDO)).toBe(true);
  });

  // O ataque medido em produção: cada `t` novo é um cache miss e ~8s de função.
  it('barra o cache-buster sem assinatura', () => {
    expect(boletimLiberado(url('?t=999999'), SEGREDO)).toBe(false);
    expect(boletimLiberado(url('?d=2026-07-17&t=1'), SEGREDO)).toBe(false);
    expect(boletimLiberado(url('?x=1'), SEGREDO)).toBe(false);
  });

  it('deixa passar a URL que o envio diário assina', () => {
    const s = assinarBoletim('2026-07-17', '29500000', SEGREDO);
    expect(boletimLiberado(url(`?d=2026-07-17&t=29500000&s=${s}`), SEGREDO)).toBe(true);
  });

  it('a assinatura vale só para aquele d e aquele t', () => {
    const s = assinarBoletim('2026-07-17', '29500000', SEGREDO);
    expect(boletimLiberado(url(`?d=2026-07-17&t=29500001&s=${s}`), SEGREDO)).toBe(false);
    expect(boletimLiberado(url(`?d=2026-07-18&t=29500000&s=${s}`), SEGREDO)).toBe(false);
  });

  it('assinatura de outro segredo não abre', () => {
    const s = assinarBoletim('2026-07-17', '1', 'outro-segredo');
    expect(boletimLiberado(url(`?d=2026-07-17&t=1&s=${s}`), SEGREDO)).toBe(false);
  });

  // Sem isto, `?d=..&t=..&s=<válida>&x=7` passaria pela assinatura e ainda assim
  // furaria o cache pelo `x`, que ninguém assinou.
  it('barra parâmetro extra pendurado numa URL assinada', () => {
    const s = assinarBoletim('2026-07-17', '1', SEGREDO);
    expect(boletimLiberado(url(`?d=2026-07-17&t=1&s=${s}&x=7`), SEGREDO)).toBe(false);
  });

  it('sem CRON_SECRET, nenhuma query passa (mas o card do dia continua de pé)', () => {
    expect(boletimLiberado(url('?d=2026-07-17&t=1&s=qualquer'), undefined)).toBe(false);
    expect(boletimLiberado(url(''), undefined)).toBe(true);
  });
});
