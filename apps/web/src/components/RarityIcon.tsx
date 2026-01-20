import rankA from "../../../../packages/catalog/ranks/rankA.png";
import rankS from "../../../../packages/catalog/ranks/rankS.png";

const rarityIcons: Record<string, string> = {
  A: rankA,
  S: rankS
};

interface RarityIconProps {
  rarity: string;
  className?: string;
}

export function RarityIcon({ rarity, className }: RarityIconProps) {
  const src = rarityIcons[rarity];
  if (!src) {
    return (
      <span className={className} aria-label={`Rarity ${rarity}`}>
        {rarity}
      </span>
    );
  }
  return <img src={src} alt={`Rarity ${rarity}`} className={className} />;
}
