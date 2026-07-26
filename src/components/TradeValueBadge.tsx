import { getTradeValue, SOURCE_ATTRIBUTION } from "../data/tradeValues";

interface Props {
  readonly itemName: string;
}

const CATEGORY_CSS: Record<string, string> = {
  "HR+":      "trade-badge-hr",
  "Mid":      "trade-badge-mid",
  "Low":      "trade-badge-low",
  "Self-use": "trade-badge-selfuse",
};

export default function TradeValueBadge({ itemName }: Props) {
  const entry = getTradeValue(itemName);
  if (!entry) return null;

  return (
    <span
      className={`trade-badge ${CATEGORY_CSS[entry.category]}`}
      title={`~${entry.category} trade value — ${SOURCE_ATTRIBUTION}`}
      aria-label={`Estimated trade value: ${entry.category}`}
    >
      ~{entry.category}
    </span>
  );
}
