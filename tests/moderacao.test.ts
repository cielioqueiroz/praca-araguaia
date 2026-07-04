import { describe, it, expect } from 'vitest';
import {
  criarToken,
  verificarToken,
  verificarSenha,
  lerTokenDoCookie,
  validarDecisao,
  tempoRelativo,
  VALIDADE_TOKEN_MS,
} from '@/lib/moderacao';

const SENHA = 'senha-forte-de-teste';
const AGORA = 1_751_600_000_000; // instante fixo

describe('token de moderação', () => {
  it('ida e volta: token criado agora é válido', () => {
    const token = criarToken(AGORA, SENHA);
    expect(verificarToken(token, AGORA, SENHA)).toBe(true);
  });

  it('ainda vale um pouco antes de expirar, expira depois de 30 dias', () => {
    const token = criarToken(AGORA, SENHA);
    expect(verificarToken(token, AGORA + VALIDADE_TOKEN_MS - 1, SENHA)).toBe(true);
    expect(verificarToken(token, AGORA + VALIDADE_TOKEN_MS, SENHA)).toBe(false);
  });

  it('rejeita assinatura adulterada', () => {
    const token = criarToken(AGORA, SENHA);
    const [expira, assinatura] = token.split('.');
    const adulterada = (assinatura[0] === 'a' ? 'b' : 'a') + assinatura.slice(1);
    expect(verificarToken(`${expira}.${adulterada}`, AGORA, SENHA)).toBe(false);
  });

  it('rejeita expiração adulterada (assinatura não bate mais)', () => {
    const token = criarToken(AGORA, SENHA);
    const [, assinatura] = token.split('.');
    expect(verificarToken(`${AGORA + VALIDADE_TOKEN_MS * 2}.${assinatura}`, AGORA, SENHA)).toBe(false);
  });

  it('rejeita token assinado com outra senha (troca de senha derruba sessões)', () => {
    const token = criarToken(AGORA, 'senha-antiga');
    expect(verificarToken(token, AGORA, SENHA)).toBe(false);
  });

  it('rejeita formatos inválidos sem lançar', () => {
    for (const lixo of ['', 'abc', '123', '123.', '.abc', 'x.y.z', `${AGORA}.zzzz-não-hex`]) {
      expect(verificarToken(lixo, AGORA, SENHA)).toBe(false);
    }
  });
});

describe('verificarSenha', () => {
  it('aceita a senha certa e rejeita errada/vazia', () => {
    expect(verificarSenha(SENHA, SENHA)).toBe(true);
    expect(verificarSenha('errada', SENHA)).toBe(false);
    expect(verificarSenha('', SENHA)).toBe(false);
  });
});

describe('lerTokenDoCookie', () => {
  it('extrai o cookie moderacao entre outros cookies', () => {
    expect(lerTokenDoCookie('a=1; moderacao=123.abc; b=2')).toBe('123.abc');
    expect(lerTokenDoCookie('moderacao=123.abc')).toBe('123.abc');
  });

  it('devolve null sem header, sem o cookie ou com valor vazio', () => {
    expect(lerTokenDoCookie(null)).toBeNull();
    expect(lerTokenDoCookie('a=1; b=2')).toBeNull();
    expect(lerTokenDoCookie('moderacao=')).toBeNull();
  });
});

describe('validarDecisao', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('aceita aprovado e rejeitado com UUID válido', () => {
    expect(validarDecisao({ id: uuid, decisao: 'aprovado' })).toEqual({ tipo: 'valido', id: uuid, decisao: 'aprovado' });
    expect(validarDecisao({ id: uuid, decisao: 'rejeitado' })).toEqual({ tipo: 'valido', id: uuid, decisao: 'rejeitado' });
  });

  it('rejeita body não-objeto, id fora do formato UUID e decisão fora dos literais', () => {
    expect(validarDecisao(null).tipo).toBe('invalido');
    expect(validarDecisao('x').tipo).toBe('invalido');
    expect(validarDecisao({ id: 'abc', decisao: 'aprovado' }).tipo).toBe('invalido');
    expect(validarDecisao({ id: uuid, decisao: 'pendente' }).tipo).toBe('invalido');
    expect(validarDecisao({ id: uuid, decisao: 'DELETE' }).tipo).toBe('invalido');
  });
});

describe('tempoRelativo', () => {
  const min = 60_000;

  it('minutos, horas e dias em pt-BR', () => {
    expect(tempoRelativo(new Date(AGORA - 15 * min).toISOString(), AGORA)).toBe('há 15 min');
    expect(tempoRelativo(new Date(AGORA - 2 * 60 * min).toISOString(), AGORA)).toBe('há 2 h');
    expect(tempoRelativo(new Date(AGORA - 24 * 60 * min).toISOString(), AGORA)).toBe('há 1 dia');
    expect(tempoRelativo(new Date(AGORA - 3 * 24 * 60 * min).toISOString(), AGORA)).toBe('há 3 dias');
  });

  it('nunca negativo (relógio adiantado vira "há 0 min")', () => {
    expect(tempoRelativo(new Date(AGORA + min).toISOString(), AGORA)).toBe('há 0 min');
  });
});
