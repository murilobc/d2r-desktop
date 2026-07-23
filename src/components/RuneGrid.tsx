import { useTranslation } from "react-i18next";
import { RUNE_DEFINITIONS } from "../data/runes";
import RuneCell from "./RuneCell";
import type { RuneInventory } from "../lib/eligibility-engine";

interface RuneGridProps {
  readonly inventory: RuneInventory;
  readonly onIncrement: (runeName: string) => void;
  readonly onDecrement: (runeName: string) => void;
  readonly onSetCount: (runeName: string, value: number) => void;
  readonly onReset: (runeName: string) => void;
}

export default function RuneGrid({
  inventory,
  onIncrement,
  onDecrement,
  onSetCount,
  onReset,
}: RuneGridProps) {
  const { t } = useTranslation();

  return (
    <div className="rune-grid-container">
      <h3 className="rune-grid-title">{t("runeGrid.title", "Rune Inventory")}</h3>
      <div className="rune-grid">
        {RUNE_DEFINITIONS.map((rune) => (
          <RuneCell
            key={rune.name}
            runeName={rune.name}
            runeLevel={rune.level}
            count={inventory[rune.name] ?? 0}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onSetCount={onSetCount}
            onReset={onReset}
          />
        ))}
      </div>
    </div>
  );
}
