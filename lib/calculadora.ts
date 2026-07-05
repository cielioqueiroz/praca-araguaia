// Arredonda a 2 casas; entrada não-finita ou negativa vira 0 (a calculadora nunca mostra NaN).
function saneia(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

// A arroba do boi gordo é 15 kg de carcaça; o rendimento converte peso vivo em carcaça.
export function arrobasDeBoi(pesoVivoKg: number, rendimentoPct: number): number {
  return saneia((pesoVivoKg * (rendimentoPct / 100)) / 15);
}

// Genérico: arrobas × R$/@ (boi) ou sacas × R$/sc (grãos).
export function valorEmReais(quantidade: number, preco: number): number {
  if (!(quantidade >= 0) || !(preco >= 0)) return 0;
  return saneia(quantidade * preco);
}

export function sacasParaKg(sacas: number): number {
  return saneia(sacas * 60);
}

export function kgParaSacas(kg: number): number {
  return saneia(kg / 60);
}
