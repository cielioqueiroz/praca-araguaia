import { describe, expect, it } from 'vitest';
import pg from 'pg';
import '@/lib/neon/cliente';

describe('tipos configurados na conexão Neon', () => {
  it('entrega números e datas no contrato usado pelos repositórios', () => {
    expect(pg.types.getTypeParser(1700)('316.50')).toBe(316.5);
    expect(pg.types.getTypeParser(1184)('2026-10-08 18:00:00+00')).toBe('2026-10-08T18:00:00.000Z');
    expect(pg.types.getTypeParser(1082)('2026-10-08')).toBe('2026-10-08');
    expect(pg.types.getTypeParser(20)('-1001234567890')).toBe(-1001234567890);
  });

  it('recusa bigint que mudaria de valor ao virar número JavaScript', () => {
    expect(() => pg.types.getTypeParser(20)('9007199254740993')).toThrow('precisão');
  });
});
