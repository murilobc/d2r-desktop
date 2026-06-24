import { getItemTier } from "../data/item-values";
import type { ItemTier } from "../data/item-values";

interface Props {
  readonly itemName: string;
  readonly category?: string;
}

export default function TierBadge({ itemName, category }: Props) {
  const tier: ItemTier = getItemTier(itemName, category);

  // Don't show badge for worthless items to reduce visual noise
  if (tier.name === "worthless") return null;

  return (
    <span className={`tier-badge ${tier.cssClass}`}>
      {tier.label}
    </span>
  );
}
