// A chuva caindo sobre a foto — leve, em CSS puro.
//
// Duas camadas de fios diagonais em velocidades diferentes dão profundidade sem
// pesar: é só background-position animado (fora da thread principal para o que
// importa), e o gradiente das camadas some nas bordas para não virar listra dura.
// Sem chuva na semana, não cai fio nenhum. prefers-reduced-motion desliga tudo
// (regra no globals.css) — a foto e a leitura ficam, o movimento não.

export function ChuvaAnimada({ seca }: { seca: boolean }) {
  if (seca) return null;
  return (
    <div className="chuva-fios" aria-hidden="true">
      <span className="chuva-camada perto" />
      <span className="chuva-camada longe" />
    </div>
  );
}
