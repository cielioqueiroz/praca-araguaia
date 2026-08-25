// Número e data em português, num lugar só.
//
// POR QUE ISTO EXISTE: havia 48 `new Intl.*` espalhados por 30 arquivos, e SEIS
// deles eram a mesma fórmula escrita à mão (min = max = casas). Duas consequências,
// e a segunda é a que dói:
//
// 1. Custo. O construtor do Intl é caro — carrega dados de locale — e quatro desses
//    seis construíam um formatador NOVO a cada chamada, dentro de função. O boletim
//    formata dezenas de números por PNG e o ticker refaz a faixa inteira. Aqui os
//    formatadores nascem uma vez e são reaproveitados por forma.
//
// 2. Divergência. Uma regra repetida em seis lugares é uma regra que um dia diverge.
//    O fuso do Araguaia aparecia digitado à mão em quinze lugares: bastava um errar
//    para uma tela anunciar o dia errado — e data errada, aqui, é a mesma família de
//    dano que preço errado.
//
// O FUSO É FIXO DE PROPÓSITO. O Araguaia fica em -03:00 sem horário de verão. Fixar
// o fuso torna a data determinística no serverless (que roda com relógio UTC) e nos
// testes. Sem isso, o boletim gerado às 21h UTC sairia com a data de amanhã.
//
// Puro e sem `node:*`, então serve ao servidor e ao navegador igualmente — o mesmo
// contrato de lib/tempo.ts.
//
// O QUE NÃO MORA AQUI, e de propósito: os formatadores da chuva (que são em UTC,
// porque a série do Open-Meteo é indexada em UTC), o eixo do gráfico e a barra do
// topo. São formas de um lugar só; trazê-las para cá seria inventar reuso que não
// existe. E `dataLocal()` continua em lib/dia-util.ts, junto da regra de feriado que
// a consome.

const FUSO = 'America/Araguaina';

const porCasas = new Map<string, Intl.NumberFormat>();

function formatadorDe(minimo: number, maximo: number): Intl.NumberFormat {
  const chave = `${minimo}:${maximo}`;
  let formatador = porCasas.get(chave);
  if (!formatador) {
    formatador = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: minimo,
      maximumFractionDigits: maximo,
    });
    porCasas.set(chave, formatador);
  }
  return formatador;
}

/**
 * Valor com casas decimais fixas — a forma do preço.
 * `numero(316.5, 2)` → `'316,50'`. O zero à direita importa: preço sem centavo
 * fechado parece truncado.
 */
export function numero(valor: number, casas: number): string {
  return formatadorDe(casas, casas).format(valor);
}

/**
 * Valor sem centavo obrigatório — a forma da quantidade.
 * `numeroEnxuto(18)` → `'18'`; `numeroEnxuto(18.5)` → `'18,5'`.
 */
export function numeroEnxuto(valor: number): string {
  return formatadorDe(0, 2).format(valor);
}

const fmtDataExtensa = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: FUSO });
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: FUSO });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });

/** Com o dia da semana: `'terça-feira, 25 de agosto de 2026'`. */
export function dataExtensa(quando: Date): string {
  return fmtDataExtensa.format(quando);
}

/** Sem o dia da semana: `'25 de agosto de 2026'`. */
export function dataLonga(quando: Date): string {
  return fmtDataLonga.format(quando);
}

/** A hora no relógio do Araguaia: `'17:30'`. */
export function horaLocal(quando: Date): string {
  return fmtHora.format(quando);
}
