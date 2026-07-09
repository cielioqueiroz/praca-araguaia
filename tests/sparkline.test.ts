import { describe, it, expect } from 'vitest';
import { caminhoSparkline } from '@/lib/sparkline';

describe('caminhoSparkline', () => {
  it('menos de 2 valores → vazio', () => {
    expect(caminhoSparkline([], 90, 30)).toBe('');
    expect(caminhoSparkline([5], 90, 30)).toBe('');
  });
  it('valor maior fica no topo (y menor)', () => {
    expect(caminhoSparkline([1, 2, 3], 90, 30)).toBe('0,30 45,15 90,0');
  });
  it('valores iguais → reta no meio', () => {
    expect(caminhoSparkline([2, 2], 90, 30)).toBe('0,15 90,15');
  });
});
