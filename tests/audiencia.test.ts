import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  codificarConvite,
  decodificarConvite,
  linkTelegram,
  resumirAudiencia,
  linhaEmTexto,
  textoResumoAudiencia,
} from '@/lib/audiencia';

describe('convite (cidade na carga do /start)', () => {
  it('vai e volta com acento e espaço', () => {
    // O Telegram só aceita A-Za-z0-9_- na carga — 'São Félix do Araguaia' precisa
    // atravessar isso inteiro.
    for (const [cidade, uf] of [['Ouricuri', 'PE'], ['São Félix do Araguaia', 'MT'], ['Redenção', 'PA']]) {
      const carga = codificarConvite(cidade, uf)!;
      expect(carga).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodificarConvite(carga)).toEqual({ cidade, uf });
    }
  });

  it('normaliza a UF para maiúscula', () => {
    expect(decodificarConvite(codificarConvite('Redenção', 'pa')!)).toEqual({ cidade: 'Redenção', uf: 'PA' });
  });

  it('recusa cidade vazia e UF que não é sigla', () => {
    expect(codificarConvite('', 'PA')).toBeNull();
    expect(codificarConvite('Redenção', '')).toBeNull();
    expect(codificarConvite('Redenção', 'Pará')).toBeNull();
  });

  it('carga forjada não vira lixo no banco', () => {
    // Qualquer um pode digitar /start <coisa>. Não dá acesso a nada — é estatística
    // —, mas o que não valida é descartado.
    expect(decodificarConvite('naoEhBase64!!')).toBeNull();
    expect(decodificarConvite('')).toBeNull();
    expect(decodificarConvite('a'.repeat(80))).toBeNull();
    expect(decodificarConvite(Buffer.from('Cidade|PARA').toString('base64url'))).toBeNull();
    expect(decodificarConvite(Buffer.from('SemBarra').toString('base64url'))).toBeNull();
    expect(decodificarConvite(Buffer.from('a|PA|b').toString('base64url'))).toBeNull();
  });
});

describe('linkTelegram', () => {
  it('leva a cidade quando ela é conhecida', () => {
    expect(linkTelegram('Ouricuri', 'PE')).toBe(
      `https://t.me/pracaaraguaia_bot?start=${codificarConvite('Ouricuri', 'PE')}`,
    );
  });

  it('sem cidade, o link limpo — que inscreve igual', () => {
    // A cidade é bônus para o painel, nunca pré-requisito da inscrição.
    expect(linkTelegram()).toBe('https://t.me/pracaaraguaia_bot');
    expect(linkTelegram(null, null)).toBe('https://t.me/pracaaraguaia_bot');
    expect(linkTelegram('Redenção', 'Pará')).toBe('https://t.me/pracaaraguaia_bot');
  });
});

const HOJE = '2026-07-16';

describe('resumirAudiencia', () => {
  it('junta inscritos e acessos por cidade', () => {
    const r = resumirAudiencia(
      [{ cidade: 'Ouricuri', uf: 'PE' }, { cidade: 'Ouricuri', uf: 'PE' }],
      [
        { dia: HOJE, cidade: 'Ouricuri', uf: 'PE', acessos: 5 },
        { dia: '2026-07-14', cidade: 'Ouricuri', uf: 'PE', acessos: 3 },
      ],
      HOJE,
    );
    expect(r.linhas).toEqual([{ cidade: 'Ouricuri', uf: 'PE', inscritos: 2, acessosHoje: 5, acessos7d: 8 }]);
    expect(r.totalInscritos).toBe(2);
    expect(r.totalAcessosHoje).toBe(5);
    expect(r.totalAcessos7d).toBe(8);
  });

  it('cidade que só acessou (sem inscrito) também aparece', () => {
    const r = resumirAudiencia([], [{ dia: HOJE, cidade: 'Vila Rica', uf: 'MT', acessos: 2 }], HOJE);
    expect(r.linhas[0]).toMatchObject({ cidade: 'Vila Rica', inscritos: 0, acessosHoje: 2 });
  });

  it('inscrito sem cidade conta no total, mas não some dele', () => {
    // Quem entrou antes desta fatia não tem cidade. Sumir do total faria o painel
    // dizer que temos menos inscritos do que temos.
    const r = resumirAudiencia(
      [{ cidade: 'Ouricuri', uf: 'PE' }, { cidade: null, uf: null }, { cidade: 'Ouricuri', uf: null }],
      [],
      HOJE,
    );
    expect(r.totalInscritos).toBe(3);
    expect(r.inscritosSemCidade).toBe(2);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].inscritos).toBe(1);
  });

  it('ordena por inscritos, depois por acesso', () => {
    const r = resumirAudiencia(
      [{ cidade: 'B', uf: 'PA' }],
      [
        { dia: HOJE, cidade: 'A', uf: 'PA', acessos: 50 },
        { dia: HOJE, cidade: 'B', uf: 'PA', acessos: 1 },
      ],
      HOJE,
    );
    expect(r.linhas.map((l) => l.cidade)).toEqual(['B', 'A']);
  });

  it('separa cidades de mesmo nome em UFs diferentes', () => {
    const r = resumirAudiencia([{ cidade: 'Bonito', uf: 'PA' }, { cidade: 'Bonito', uf: 'MS' }], [], HOJE);
    expect(r.linhas).toHaveLength(2);
  });

  it('sem nada, devolve zeros sem quebrar', () => {
    const r = resumirAudiencia([], [], HOJE);
    expect(r).toEqual({ linhas: [], totalInscritos: 0, inscritosSemCidade: 0, totalAcessosHoje: 0, totalAcessos7d: 0 });
  });
});

describe('linhaEmTexto', () => {
  it('é o formato que o dono pediu', () => {
    expect(linhaEmTexto({ cidade: 'Ouricuri', uf: 'PE', inscritos: 2, acessosHoje: 5, acessos7d: 8 }))
      .toBe('Ouricuri-PE — 2 inscritos · 5 acessos hoje');
  });

  it('singular no singular', () => {
    expect(linhaEmTexto({ cidade: 'Redenção', uf: 'PA', inscritos: 1, acessosHoje: 1, acessos7d: 1 }))
      .toBe('Redenção-PA — 1 inscrito · 1 acesso hoje');
  });
});

describe('textoResumoAudiencia', () => {
  it('lista as cidades e o total', () => {
    const r = resumirAudiencia(
      [{ cidade: 'Ouricuri', uf: 'PE' }, { cidade: 'Ouricuri', uf: 'PE' }],
      [{ dia: HOJE, cidade: 'Ouricuri', uf: 'PE', acessos: 5 }],
      HOJE,
    );
    const t = textoResumoAudiencia(r, '16 de julho de 2026');
    expect(t).toContain('Ouricuri-PE — 2 inscritos · 5 acessos hoje');
    expect(t).toContain('Total: 2 inscritos · 5 acessos hoje · 5 em 7 dias');
  });

  it('sem ninguém, diz isso em vez de mandar uma lista vazia', () => {
    expect(textoResumoAudiencia(resumirAudiencia([], [], HOJE), '16 de julho de 2026'))
      .toContain('Ainda sem inscritos nem acessos');
  });

  it('corta em 10 cidades — é uma mensagem de Telegram, não um relatório', () => {
    const visitas = Array.from({ length: 20 }, (_, i) => ({ dia: HOJE, cidade: `Cidade ${i}`, uf: 'PA', acessos: 20 - i }));
    const t = textoResumoAudiencia(resumirAudiencia([], visitas, HOJE), '16 de julho de 2026');
    expect(t.split('\n').filter((l) => l.startsWith('• '))).toHaveLength(10);
  });
});

describe('o resumo é só do dono', () => {
  it('audiencia-envio não importa o broadcast nem o chama', () => {
    // O dono perguntou explicitamente se os inscritos receberiam a contagem. Não —
    // e este teste trava isso: mandar a audiência no broadcast vazaria justamente o
    // que a fatia protege.
    //
    // Olha só o código, ignorando comentário: o aviso em prosa no topo do arquivo
    // cita 'enviarEmMassa' de propósito, e um grep cru quebraria por causa dele.
    const fonte = readFileSync(join(process.cwd(), 'lib', 'audiencia-envio.ts'), 'utf-8');
    const codigo = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');

    expect(codigo).not.toMatch(/enviarEmMassa\s*\(/);
    expect(codigo).not.toMatch(/from\s+['"].*telegram-broadcast['"]/);
    expect(codigo).toContain('TELEGRAM_DONO_CHAT_ID');
    // Manda para UM chat: o do dono.
    expect(codigo).toMatch(/enviarTexto\(token,\s*dono,/);
  });
});
