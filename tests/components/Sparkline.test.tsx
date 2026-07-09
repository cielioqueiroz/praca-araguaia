import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/Sparkline';

describe('Sparkline', () => {
  it('renderiza uma polyline com ≥2 valores', () => {
    const { container } = render(<Sparkline valores={[1, 2, 3]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
  it('não renderiza nada com <2 valores', () => {
    const { container } = render(<Sparkline valores={[1]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('cor verde quando sobe, vermelha quando cai', () => {
    const up = render(<Sparkline valores={[1, 3]} />).container.querySelector('polyline');
    expect(up?.getAttribute('stroke')).toBe('#059669');
    const down = render(<Sparkline valores={[3, 1]} />).container.querySelector('polyline');
    expect(down?.getAttribute('stroke')).toBe('#dc2626');
  });
});
