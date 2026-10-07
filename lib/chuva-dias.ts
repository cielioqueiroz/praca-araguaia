import type { DiaPrevisao } from '@/lib/fontes/chuva';

export type DiasOpenMeteo = {
  time?: string[];
  precipitation_sum?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  temperature_2m_max?: (number | null)[];
};

// POR QUE ISTO EXISTE: a previsão local convertia `null` em 0 mm e 0 °C. Uma
// resposta incompleta da fonte parecia uma semana seca; sem leitura completa,
// o card local informa indisponibilidade.
export function diasDaPrevisao(dados?: DiasOpenMeteo): DiaPrevisao[] | null {
  const datas = dados?.time;
  if (!datas?.length || !dados?.precipitation_sum || !dados.temperature_2m_min || !dados.temperature_2m_max) {
    return null;
  }

  const dias: DiaPrevisao[] = [];
  for (let i = 0; i < datas.length; i++) {
    const chuvaMm = dados.precipitation_sum[i];
    const tempMin = dados.temperature_2m_min[i];
    const tempMax = dados.temperature_2m_max[i];
    const probabilidade = dados.precipitation_probability_max?.[i];
    if (
      typeof chuvaMm !== 'number' || !Number.isFinite(chuvaMm) ||
      typeof tempMin !== 'number' || !Number.isFinite(tempMin) ||
      typeof tempMax !== 'number' || !Number.isFinite(tempMax)
    ) return null;
    dias.push({
      data: datas[i],
      chuvaMm,
      probMax: typeof probabilidade === 'number' && Number.isFinite(probabilidade) ? probabilidade : null,
      tempMin,
      tempMax,
    });
  }
  return dias;
}
