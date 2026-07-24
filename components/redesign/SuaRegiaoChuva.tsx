'use client';

import { useEffect, useState } from 'react';
import { CardChuva } from '@/components/CardChuva';
import { recadoDaSemana } from '@/lib/chuva-recado';

type Dia = { data: string; chuvaMm: number; probMax: number | null; tempMin: number; tempMax: number };
type Local = { cidade: string; uf: string; tempAtual: number | null; dias: Dia[] };

const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const emUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const semPonto = (s: string) => s.replace('.', '');

// O recado ao lado do card: responde "e daí?". O título dá o veredito; depois,
// três leituras — a chuva (onde ela se concentra), o calor (a faixa da semana) e a
// lida (a janela seca para pulverizar ou colher). Complementa o card da esquerda,
// que é a tabela dia a dia; aqui é a interpretação.
function Recado({ dias }: { dias: Dia[] }) {
  const r = recadoDaSemana(dias);
  const dia = (i: number) => (i >= 0 && dias[i] ? fmtDiaLongo.format(emUtc(dias[i].data)) : '');

  let titulo: string;
  if (r.semanaSeca) titulo = 'Sete dias sem chuva na sua região.';
  else if (r.iChegada === -1) titulo = 'Só garoa nos próximos dias — nada que encharque.';
  else if (r.iChegada === 0) titulo = 'Chove hoje na sua região.';
  else titulo = `A chuva chega ${dia(r.iChegada)}.`;

  const linhas: Array<{ rotulo: string; texto: string }> = [];

  // A CHUVA — onde a água se concentra (o título já disse quando ela chega). Sempre
  // presente, para o card não ficar curto numa semana seca.
  if (r.semanaSeca) {
    linhas.push({ rotulo: 'A chuva', texto: 'Céu firme, sem nuvem de chuva à vista nos sete dias.' });
  } else if (r.iMaisMolhado === -1 || r.iChegada === -1) {
    linhas.push({ rotulo: 'A chuva', texto: `Só pingos: ${r.totalMm.toLocaleString('pt-BR')} mm espalhados, nada que encharque.` });
  } else {
    const md = dias[r.iMaisMolhado];
    const mm = md.chuvaMm.toLocaleString('pt-BR');
    if (r.diasComChuva === 1) {
      linhas.push({ rotulo: 'A chuva', texto: `Cai só ${dia(r.iMaisMolhado)}, ${mm} mm — o resto da semana é seco.` });
    } else {
      const pct = r.totalMm > 0 ? Math.round((md.chuvaMm / r.totalMm) * 100) : 0;
      linhas.push({
        rotulo: 'A chuva',
        texto: `O forte é ${dia(r.iMaisMolhado)}, ${mm} mm — ${pct}% da água que cai na semana.`,
      });
    }
  }

  // O CALOR — a faixa da semana, dos dados de temperatura do próprio local.
  const maxMax = Math.round(Math.max(...dias.map((d) => d.tempMax)));
  const minMin = Math.round(Math.min(...dias.map((d) => d.tempMin)));
  linhas.push({ rotulo: 'O calor', texto: `Máximas até ${maxMax}°, mínimas perto de ${minMin}°.` });

  // PARA A LIDA — a janela de trabalho.
  if (r.semanaSeca || r.janela.tamanho === dias.length) {
    linhas.push({ rotulo: 'Para a lida', texto: 'Semana toda livre para pulverizar e colher — o pasto é que pede água.' });
  } else if (r.janela.tamanho >= 2) {
    const ini = semPonto(fmtDiaCurto.format(emUtc(dias[r.janela.inicio].data)));
    const fim = semPonto(fmtDiaCurto.format(emUtc(dias[r.janela.fim].data)));
    linhas.push({ rotulo: 'Para a lida', texto: `Janela seca de ${ini} a ${fim} — para pulverizar ou colher.` });
  } else {
    linhas.push({ rotulo: 'Para a lida', texto: 'Sem folga seca esta semana; o pasto agradece a água.' });
  }

  return (
    <div className="chrecado" data-cartao>
      <span className="chrecado-tit">Para a sua região</span>
      <p className="chrecado-frase">{titulo}</p>

      <div className="chrecado-linhas">
        {linhas.map((l) => (
          <div key={l.rotulo} className="chrecado-linha">
            <span className="chrecado-rot">{l.rotulo}</span>
            <span className="chrecado-txt">{l.texto}</span>
          </div>
        ))}
      </div>

      <div className="chrecado-nums">
        <span>
          <b>{r.totalMm.toLocaleString('pt-BR')}</b> mm em 7 dias
        </span>
        <span>
          <b>{r.diasComChuva}</b> {r.diasComChuva === 1 ? 'dia' : 'dias'} de chuva
        </span>
        <span>
          <b>{r.diasSecos}</b> {r.diasSecos === 1 ? 'seco' : 'secos'}
        </span>
      </div>
    </div>
  );
}

export function SuaRegiaoChuva() {
  const [loc, setLoc] = useState<Local | null>(null);

  useEffect(() => {
    const porIP = () =>
      fetch('/api/chuva-local')
        .then((r) => r.json())
        .then((d: Local) => setLoc(d))
        .catch(() => {});

    if (!navigator.geolocation) {
      porIP();
      return;
    }
    // Tenta a localização exata (em tempo real) primeiro; cai pro IP se negar.
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const [geo, met] = await Promise.all([
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
            ).then((r) => r.json()),
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                '&current=temperature_2m&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
                '&timezone=auto&forecast_days=7',
            ).then((r) => r.json()),
          ]);
          const d = met.daily;
          const dias: Dia[] = (d?.time ?? []).map((data: string, i: number) => ({
            data,
            chuvaMm: Number(d.precipitation_sum?.[i] ?? 0),
            probMax: d.precipitation_probability_max?.[i] ?? null,
            tempMin: Number(d.temperature_2m_min?.[i]),
            tempMax: Number(d.temperature_2m_max?.[i]),
          }));
          setLoc({
            cidade: geo.city || geo.locality || geo.principalSubdivision || 'Sua região',
            uf: String(geo.principalSubdivisionCode || '').split('-').pop() || '',
            tempAtual: typeof met?.current?.temperature_2m === 'number' ? Math.round(met.current.temperature_2m) : null,
            dias,
          });
        } catch {
          porIP();
        }
      },
      () => porIP(),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  if (!loc || loc.dias.length === 0) return null;

  // É o MESMO card das cidades da praça — só com a etiqueta "Sua região" e a
  // temperatura de agora. Antes, esta lista era uma segunda implementação dos 7 dias,
  // e por isso ficou para trás quando os cards ganharam ícone e traço no dia seco.
  return (
    <section className="chsec">
      <div className="chsechead">
        <h2>Onde você está</h2>
        <span className="regra" />
        <span className="chlegenda">pela sua localização</span>
      </div>
      <div className="chvoce">
        <CardChuva
          previsao={{ municipio: loc.cidade, uf: loc.uf, dias: loc.dias }}
          etiqueta="Sua região"
          tempAtual={loc.tempAtual}
        />
        <Recado dias={loc.dias} />
      </div>
    </section>
  );
}
