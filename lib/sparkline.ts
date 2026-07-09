// Pontos de uma <polyline> SVG (sparkline). Valor maior → y menor (linha sobe).
// Menos de 2 valores → vazio. Valores iguais → reta no meio.
export function caminhoSparkline(valores: number[], largura: number, altura: number): string {
  if (valores.length < 2) return '';
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const range = max - min;
  const n = valores.length;
  const arred = (v: number) => Math.round(v * 100) / 100;
  return valores
    .map((v, i) => {
      const x = arred((i / (n - 1)) * largura);
      const y = arred(range === 0 ? altura / 2 : altura - ((v - min) / range) * altura);
      return `${x},${y}`;
    })
    .join(' ');
}
