import type { IconType } from 'react-icons';
import { GiCow, GiBull, GiCorn, GiPlantSeed, GiGoldBar } from 'react-icons/gi';
import { FaDollarSign, FaEuroSign, FaBitcoin, FaEthereum } from 'react-icons/fa';
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
  ouro18k: GiGoldBar,
  bitcoin: FaBitcoin,
  ethereum: FaEthereum,
};

// Recortes (PNG/JPG transparentes) usados na faixa de foto de cada card.
// Vaca, novilha e bezerro ainda não têm recorte próprio — sem foto, o card mostra
// só a faixa com o ícone. Usar a foto do nelore para as três seria mentir na imagem.
export const FOTO_COMMODITY: Record<string, string> = {
  boi: '/assets/cards/boi.png',
  soja: '/assets/cards/soja.png',
  milho: '/assets/cards/milho.png',
  dolar: '/assets/cards/dolar.png',
  euro: '/assets/cards/euro.png',
  ouro: '/assets/cards/ouro.png',
  ouro18k: '/assets/cards/ouro.png', // mesmo metal, outra liga
  bitcoin: '/assets/cards/bitcoin.png',
  ethereum: '/assets/cards/ethereum.png',
};

export function IconeCommodity({ tipo, className }: { tipo: string; className?: string }) {
  const Icone = ICONES[tipo] ?? GiCow;
  return <Icone className={className} aria-hidden />;
}
