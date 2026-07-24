// Dia útil no Brasil — quem decide se o boletim sai hoje.
//
// O boletim é uma peça de MERCADO: fala de pregão, de fechamento e de arroba
// negociada. Em sábado, domingo e feriado não há nada disso, e mandar o card
// mesmo assim seria repetir o número de sexta com data de hoje — a mesma
// impressão de "congelado" que o dono relatou em 23/07/2026.
//
// O cron da Vercel já recorta segunda a sexta (`* * 1-5`), mas ele não conhece
// feriado. Esta é a segunda tranca, e a que importa: se alguém trocar o cron, ou
// disparar a rota à mão, o feriado continua barrado.
//
// QUAIS FERIADOS. Só os de alcance nacional, como o dono pediu — nenhum
// municipal, nenhum estadual (o 15/08 de Belém não existe aqui). Os fixos são os
// da Lei 662/1949, com Finados (6.802/1980) e a Consciência Negra, nacional desde
// a Lei 14.759/2024. Junto vão os três móveis de Páscoa — Carnaval, Sexta-feira
// Santa e Corpus Christi: não são feriado por lei federal, mas a B3 não abre e a
// Scot não publica, então para um boletim de mercado o dia simplesmente não
// existe. Também são de alcance nacional, então não ferem o "apenas os nacionais".

const FUSO = 'America/Araguaina';

// 'en-CA' formata como AAAA-MM-DD, que é o que queremos comparar.
const fmtDataLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fmtDiaDaSemana = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' });

/** O instante, lido no calendário do Araguaia: '2026-07-23'. */
export function dataLocal(quando: Date): string {
  return fmtDataLocal.format(quando);
}

/** Sábado ou domingo no fuso do Araguaia. */
export function fimDeSemana(quando: Date): boolean {
  const dia = fmtDiaDaSemana.format(quando);
  return dia === 'Sat' || dia === 'Sun';
}

// Feriados nacionais de data fixa, como MM-DD.
const FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

/**
 * Domingo de Páscoa do ano, em UTC — algoritmo gregoriano anônimo
 * (Meeus/Jones/Butcher). É dele que saem Carnaval, Sexta-feira Santa e Corpus
 * Christi, que andam pelo calendário todo ano.
 */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function comoIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function somarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 24 * 60 * 60 * 1000);
}

/** Os feriados móveis do ano, como AAAA-MM-DD → nome. */
export function moveisDoAno(ano: number): Record<string, string> {
  const pascoa = domingoDePascoa(ano);
  return {
    [comoIso(somarDias(pascoa, -48))]: 'Carnaval',
    [comoIso(somarDias(pascoa, -47))]: 'Carnaval',
    [comoIso(somarDias(pascoa, -2))]: 'Sexta-feira Santa',
    [comoIso(somarDias(pascoa, 60))]: 'Corpus Christi',
  };
}

/** O nome do feriado nacional naquele dia, ou null se for dia comum. */
export function feriadoNacional(quando: Date): string | null {
  const iso = dataLocal(quando);
  const fixo = FIXOS[iso.slice(5)];
  if (fixo) return fixo;
  return moveisDoAno(Number(iso.slice(0, 4)))[iso] ?? null;
}

export type Veredito = { ehDiaUtil: true } | { ehDiaUtil: false; motivo: string };

/**
 * O boletim pode sair neste instante?
 *
 * Devolve o MOTIVO junto porque a rota registra no log e responde com ele: quando
 * o dono perguntar "por que não chegou hoje?", a resposta tem de estar escrita.
 */
export function diaUtil(quando: Date = new Date()): Veredito {
  if (fimDeSemana(quando)) return { ehDiaUtil: false, motivo: 'fim de semana' };
  const feriado = feriadoNacional(quando);
  if (feriado) return { ehDiaUtil: false, motivo: `feriado nacional: ${feriado}` };
  return { ehDiaUtil: true };
}
