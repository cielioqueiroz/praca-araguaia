import type { IconType } from 'react-icons';
import { GiCow, GiBull, GiCorn, GiPlantSeed, GiGoldBar } from 'react-icons/gi';
import { FaDollarSign, FaEuroSign, FaBitcoin, FaEthereum, FaChartLine } from 'react-icons/fa';
import { PiCow } from 'react-icons/pi';

// Ícones de marca (react-icons) para identificar cada cotação de relance.
// Não existe ícone de bezerro em nenhum pack: as categorias de gado se distinguem
// pelo desenho (touro chifrudo / vaca cheia / traço fino para os jovens), e o
// título ao lado sempre diz qual é qual.
const ICONES: Record<string, IconType> = {
  boi: GiBull,
  vaca: GiCow,
  novilha: PiCow,
  bezerro: PiCow,
  soja: GiPlantSeed,
  milho: GiCorn,
  dolar: FaDollarSign,
  euro: FaEuroSign,
  ouro: GiGoldBar,
  ibovespa: FaChartLine,
  bitcoin: FaBitcoin,
  ethereum: FaEthereum,
};

// Recortes (PNG transparentes) usados na faixa de foto de cada card. Os do gado saem
// das fotos que o dono do projeto escolheu, com o fundo removido (rembg) — cada
// categoria tem o SEU animal: bezerro é bezerro, não touro adulto.
export const FOTO_COMMODITY: Record<string, string> = {
  boi: '/assets/cards/boi.png',
  vaca: '/assets/cards/vaca.png',
  novilha: '/assets/cards/novilha.png',
  bezerro: '/assets/cards/bezerro.png',
  soja: '/assets/cards/soja.png',
  milho: '/assets/cards/milho.png',
  dolar: '/assets/cards/dolar.png',
  euro: '/assets/cards/euro.png',
  ouro: '/assets/cards/ouro.png',
  ibovespa: '/assets/cards/ibovespa.png', // um índice não tem foto: é a linha do pregão
  bitcoin: '/assets/cards/bitcoin.png',
  ethereum: '/assets/cards/ethereum.png',
};

export function IconeCommodity({ tipo, className }: { tipo: string; className?: string }) {
  const Icone = ICONES[tipo] ?? GiCow;
  return <Icone className={className} aria-hidden />;
}
