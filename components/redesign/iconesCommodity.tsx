import type { IconType } from 'react-icons';
import { GiCow, GiCorn, GiPlantSeed, GiGoldBar } from 'react-icons/gi';
import { FaDollarSign, FaEuroSign } from 'react-icons/fa';

// Ícones de marca (react-icons) para identificar cada cotação de relance.
const ICONES: Record<string, IconType> = {
  boi: GiCow,
  soja: GiPlantSeed,
  milho: GiCorn,
  dolar: FaDollarSign,
  euro: FaEuroSign,
  ouro: GiGoldBar,
};

// Recortes (PNG/JPG transparentes) usados na faixa de foto de cada card.
export const FOTO_COMMODITY: Record<string, string> = {
  boi: '/assets/cards/boi.png',
  soja: '/assets/cards/soja.png',
  milho: '/assets/cards/milho.png',
  dolar: '/assets/cards/dolar.png',
  euro: '/assets/cards/euro.png',
  ouro: '/assets/cards/ouro.png',
};

export function IconeCommodity({ tipo, className }: { tipo: string; className?: string }) {
  const Icone = ICONES[tipo] ?? GiCow;
  return <Icone className={className} aria-hidden />;
}
