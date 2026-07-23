import { useTranslation } from "react-i18next";
import { RUNE_ORDER } from "../data/runes";
import type { RuneInventory } from "../lib/eligibility-engine";

interface RuneGridProps {
  readonly inventory: RuneInventory;
  readonly onIncrement: (runeName: string) => void;
  readonly onDecrement: (runeName: string) => void;
}

export default function RuneGrid({ inventory, onIncrement, onDecrement }: RuneGridProps) {
  const { t } = useTranslation();

  return (
    <div className="rune-grid-container">
      <h3 className="rune-grid-title">{t("runeGrid.title", "Rune Inventory")}</h3>
      <div className="rune-grid">
        {RUNE_ORDER.map((rune) => {
          const count = inventory[rune] ?? 0;
          const isZero = count === 0;

          return (
            <div
              key={rune}
              className={`rune-cell${isZero ? " rune-cell--zero" : ""}`}
            >
              <span className="rune-cell__name">{rune}</span>
              <span className="rune-cell__count">{count}</span>
              <div className="rune-cell__controls">
                <button
                  className="rune-cell__btn rune-cell__btn--decrement"
                  onClick={() => onDecrement(rune)}
                  disabled={isZero}
                  aria-label={t("runeGrid.decrement", { rune, defaultValue: `Decrement ${rune}` })}
                  type="button"
                >
                  −
                </button>
                <button
                  className="rune-cell__btn rune-cell__btn--increment"
                  onClick={() => onIncrement(rune)}
                  aria-label={t("runeGrid.increment", { rune, defaultValue: `Increment ${rune}` })}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
