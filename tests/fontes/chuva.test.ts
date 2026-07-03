import { describe, it, expect, vi } from 'vitest';
import { buscarPrevisao, MUNICIPIOS } from '@/lib/fontes/chuva';

const DIAS = ['2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'];

const diario = () => ({
  time: DIAS,
  precipitation_sum: [0, 1.5, 12.3, 0, 0, 4.2, 0],
  precipitation_probability_max: [0, 45, 90, null, 10, 60, 20],
  temperature_2m_max: [33.5, 34, 35, 33, 32, 31, 30],
  temperature_2m_min: [19.9, 20, 21, 19, 18, 17, 16],
});

const FIXTURE = Array.from({ length: 5 }, () => ({ daily: diario() }));

function fetchComJson(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;
}

describe('buscarPrevisao', () => {
  it('monta os 5 municípios na ordem da lista fixa', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p.map((x) => x.municipio)).toEqual(MUNICIPIOS.map((m) => m.nome));
    expect(p[0]).toMatchObject({ municipio: 'Redenção', uf: 'PA' });
    expect(p[4]).toMatchObject({ municipio: 'São Félix do Araguaia', uf: 'MT' });
  });

  it('mapeia os 7 dias com chuva, probabilidade e temperaturas', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p[0].dias).toHaveLength(7);
    expect(p[0].dias[2]).toEqual({ data: '2026-07-05', chuvaMm: 12.3, probMax: 90, tempMin: 21, tempMax: 35 });
  });

  it('preserva probabilidade null (dias distantes sem dado)', async () => {
    const p = await buscarPrevisao(fetchComJson(FIXTURE));
    expect(p[0].dias[3].probMax).toBeNull();
  });

  it('faz uma única chamada com todas as coordenadas', async () => {
    const f = fetchComJson(FIXTURE);
    await buscarPrevisao(f);
    expect(f).toHaveBeenCalledTimes(1);
    const url = String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain('-8.02861');
    expect(url).toContain('-11.61722');
    expect(url).toContain('forecast_days=7');
  });

  it('rejeita quando o HTTP não é ok', async () => {
    await expect(buscarPrevisao(fetchComJson({}, false, 500))).rejects.toThrow(/Open-Meteo/);
  });

  it('rejeita quando a quantidade de localidades não confere', async () => {
    await expect(buscarPrevisao(fetchComJson(FIXTURE.slice(0, 3)))).rejects.toThrow(/localidades/);
  });

  it('rejeita quando o daily vem ausente', async () => {
    const quebrado = [...FIXTURE.slice(0, 4), {}];
    await expect(buscarPrevisao(fetchComJson(quebrado))).rejects.toThrow(/São Félix/);
  });
});
