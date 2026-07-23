import { useTranslation } from "react-i18next";
import { RUNE_ORDER } from "../data/runes";
import { calculateUpgradePath } from "../lib/cube-engine";
import type { RuneInventory } from "../lib/eligibility-engine";

interface CubeCalculatorProps {
  readonly inventory: RuneInventory;
  readonly targetRune: string | null;
  readonly onSelectRune: (runeName: string) => void;
}

export default function CubeCalculator({
  inventory,
  targetRune,
  onSelectRune,
}: CubeCalculatorProps) {
  const { t } = useTranslation();

  const upgradePath = targetRune
    ? calculateUpgradePath(targetRune, inventory)
    : null;

  return (
    <section className="cube-calculator" aria-labelledby="cube-calculator-title">
      <h3 id="cube-calculator-title">
        {t("runewordPlanner.cubeCalculator.title", "Cube Calculator")}
      </h3>

      <div className="cube-calculator-select">
        <label htmlFor="cube-target-rune">
          {t("runewordPlanner.cubeCalculator.targetRune", "Target Rune")}
        </label>
        <select
          id="cube-target-rune"
          value={targetRune ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              onSelectRune(e.target.value);
            }
          }}
        >
          <option value="">
            {t("runewordPlanner.cubeCalculator.selectRune", "Select a rune...")}
          </option>
          {RUNE_ORDER.map((rune) => (
            <option key={rune} value={rune}>
              {rune}
            </option>
          ))}
        </select>
      </div>

      {upgradePath && upgradePath.alreadyOwned && (
        <p className="cube-calculator-owned">
          {t(
            "runewordPlanner.cubeCalculator.noUpgradesNeeded",
            "No upgrades needed — you already own {{rune}}.",
            { rune: targetRune }
          )}
        </p>
      )}

      {upgradePath && !upgradePath.alreadyOwned && upgradePath.steps.length > 0 && (
        <div className="cube-calculator-results">
          <table className="cube-calculator-table" aria-label={t("runewordPlanner.cubeCalculator.upgradePathLabel", "Upgrade path breakdown")}>
            <thead>
              <tr>
                <th>{t("runewordPlanner.cubeCalculator.rune", "Rune")}</th>
                <th>{t("runewordPlanner.cubeCalculator.needed", "Needed")}</th>
                <th>{t("runewordPlanner.cubeCalculator.have", "Have")}</th>
                <th>{t("runewordPlanner.cubeCalculator.remaining", "Remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {upgradePath.steps.map((step) => (
                <tr key={step.rune} className={step.remaining === 0 ? "cube-step-satisfied" : ""}>
                  <td>{step.rune}</td>
                  <td>{step.needed}</td>
                  <td>{step.have}</td>
                  <td>{step.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="cube-calculator-summary">
            {t(
              "runewordPlanner.cubeCalculator.totalBaseRunes",
              "Total base runes (El-equivalent): {{count}}",
              { count: upgradePath.totalBaseRunes }
            )}
          </p>
        </div>
      )}

      {upgradePath && !upgradePath.alreadyOwned && upgradePath.steps.length === 0 && (
        <p className="cube-calculator-empty">
          {t(
            "runewordPlanner.cubeCalculator.noPath",
            "No upgrade path available for this rune."
          )}
        </p>
      )}

      {!targetRune && (
        <p className="cube-calculator-prompt">
          {t(
            "runewordPlanner.cubeCalculator.prompt",
            "Select a target rune to calculate the upgrade path."
          )}
        </p>
      )}
    </section>
  );
}
