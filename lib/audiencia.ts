// Quem está acompanhando a praça, por cidade — sem saber quem é ninguém.
//
// O Telegram NÃO informa a cidade de quem se inscreve: o bot só recebe um chat_id.
// A cidade é capturada no site, no momento do clique, e viaja no link do convite
// (t.me/bot?start=<carga>). O /start decodifica e guarda cidade/UF junto do chat_id.
//
// Nada aqui identifica pessoa: só cidade, UF e contagem. Sem IP, sem nome, sem
// telefone — nem no painel, que ainda por cima tem senha.

export const USUARIO_BOT = 'pracaaraguaia_bot';

export type Convite = { cidade: string; uf: string };

/** O Telegram só aceita A-Za-z0-9_- na carga do /start, até 64 caracteres. */
function paraBase64Url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf-8');
}

const UF_RE = /^[A-Z]{2}$/;
const LIMITE_CARGA = 64;

/** 'Ouricuri' + 'PE' → carga do /start. Cidade vazia ou UF inválida → null. */
export function codificarConvite(cidade: string, uf: string): string | null {
  const c = cidade.trim().slice(0, 40);
  const u = uf.trim().toUpperCase();
  if (c === '' || !UF_RE.test(u)) return null;

  const carga = paraBase64Url(`${c}|${u}`);
  // Carga grande demais o Telegram simplesmente descarta — melhor mandar o link
  // limpo e ficar sem a cidade do que mandar um link que não inscreve ninguém.
  return carga.length <= LIMITE_CARGA ? carga : null;
}

/**
 * Carga do /start → cidade/UF.
 *
 * A carga é forjável: qualquer um pode digitar /start <coisa>. Não dá acesso a
 * nada — é estatística —, mas o que não passar na validação é descartado em vez de
 * virar lixo no banco.
 */
export function decodificarConvite(carga: string): Convite | null {
  if (typeof carga !== 'string' || carga.length === 0 || carga.length > LIMITE_CARGA) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(carga)) return null;

  try {
    const [cidade, uf, ...sobra] = deBase64Url(carga).split('|');
    if (sobra.length > 0) return null;
    if (!cidade || cidade.length > 40 || !uf || !UF_RE.test(uf)) return null;
    return { cidade, uf };
  } catch {
    return null;
  }
}

/** O link do convite. Sem cidade conhecida, o link limpo — que inscreve igual. */
export function linkTelegram(cidade?: string | null, uf?: string | null): string {
  const base = `https://t.me/${USUARIO_BOT}`;
  if (!cidade || !uf) return base;
  const carga = codificarConvite(cidade, uf);
  return carga ? `${base}?start=${carga}` : base;
}

// ——— O painel ———

export type LinhaAudiencia = {
  cidade: string;
  uf: string;
  inscritos: number;
  acessosHoje: number;
  acessos7d: number;
};

export type ResumoAudiencia = {
  linhas: LinhaAudiencia[];
  totalInscritos: number;
  /** Inscritos que entraram antes de a gente passar a capturar a cidade. */
  inscritosSemCidade: number;
  totalAcessosHoje: number;
  totalAcessos7d: number;
};

export type InscritoBruto = { cidade: string | null; uf: string | null };
export type VisitaBruta = { dia: string; cidade: string; uf: string; acessos: number };

const chave = (cidade: string, uf: string) => `${cidade}|${uf}`;

/**
 * Junta inscritos e visitas numa lista por cidade, ordenada por quem mais aparece.
 *
 * Puro: recebe as linhas do banco e o dia de hoje (o chamador resolve o fuso), sem
 * ler relógio nem banco.
 */
export function resumirAudiencia(
  inscritos: InscritoBruto[],
  visitas: VisitaBruta[],
  hoje: string,
): ResumoAudiencia {
  const mapa = new Map<string, LinhaAudiencia>();
  const pegar = (cidade: string, uf: string): LinhaAudiencia => {
    const k = chave(cidade, uf);
    const atual = mapa.get(k) ?? { cidade, uf, inscritos: 0, acessosHoje: 0, acessos7d: 0 };
    mapa.set(k, atual);
    return atual;
  };

  let inscritosSemCidade = 0;
  for (const i of inscritos) {
    // Quem se inscreveu antes desta fatia não tem cidade. Some da lista, mas não
    // do total — senão o painel diria que temos menos inscritos do que temos.
    if (!i.cidade || !i.uf) {
      inscritosSemCidade += 1;
      continue;
    }
    pegar(i.cidade, i.uf).inscritos += 1;
  }

  let totalAcessosHoje = 0;
  let totalAcessos7d = 0;
  for (const v of visitas) {
    const linha = pegar(v.cidade, v.uf);
    linha.acessos7d += v.acessos;
    totalAcessos7d += v.acessos;
    if (v.dia === hoje) {
      linha.acessosHoje += v.acessos;
      totalAcessosHoje += v.acessos;
    }
  }

  const linhas = [...mapa.values()].sort(
    (a, b) =>
      b.inscritos - a.inscritos ||
      b.acessos7d - a.acessos7d ||
      a.cidade.localeCompare(b.cidade, 'pt-BR'),
  );

  return {
    linhas,
    totalInscritos: inscritos.length,
    inscritosSemCidade,
    totalAcessosHoje,
    totalAcessos7d,
  };
}

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** 'Ouricuri-PE — 2 inscritos · 5 acessos hoje' */
export function linhaEmTexto(l: LinhaAudiencia): string {
  const partes = [plural(l.inscritos, 'inscrito', 'inscritos'), `${l.acessosHoje} ${l.acessosHoje === 1 ? 'acesso' : 'acessos'} hoje`];
  return `${l.cidade}-${l.uf} — ${partes.join(' · ')}`;
}

/**
 * O resumo diário que vai para o DONO, e só para ele.
 *
 * Este texto NUNCA vai para os inscritos: eles recebem boletim e alerta de preço.
 * Mandar a audiência no broadcast vazaria justamente o que esta fatia protege.
 */
export function textoResumoAudiencia(r: ResumoAudiencia, dataExtenso: string): string {
  const cabeca = `Praça Araguaia — audiência de ${dataExtenso}`;
  if (r.linhas.length === 0 && r.totalInscritos === 0) {
    return `${cabeca}\n\nAinda sem inscritos nem acessos registrados.`;
  }

  const topo = r.linhas.slice(0, 10).map((l) => `• ${linhaEmTexto(l)}`);
  const rodape = [
    '',
    `Total: ${plural(r.totalInscritos, 'inscrito', 'inscritos')} · ${r.totalAcessosHoje} acessos hoje · ${r.totalAcessos7d} em 7 dias`,
  ];
  if (r.inscritosSemCidade > 0) {
    rodape.push(`(${plural(r.inscritosSemCidade, 'inscrito', 'inscritos')} sem cidade — entraram antes do convite com localização)`);
  }

  return [cabeca, '', ...topo, ...rodape].join('\n');
}
