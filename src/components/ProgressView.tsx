import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { calculateProgress } from "../lib/eligibility-engine";
import type { RuneInventory } from "../lib/eligibility-engine";
import type { RunewordRecipe } from "../data/runewords";
import type { RunewordTarget } from "../types";

interface ProgressViewProps {
  readonly inventory: RuneInventory;
  readonly targets: RunewordTarget[];
  readonly recipes: RunewordRecipe[];
  readonly onRemoveTarget: (id: string) => void;
  readonly onAddTarget: (runewordName: string) => void;
}

export default function ProgressView({
  inventory,
  targets,
  recipes,
  onRemoveTarget,
  onAddTarget,
}: ProgressViewProps) {
  const { t } = useTranslation();
  const [selectedRuneword, setSelectedRuneword] = useState("");

  const targetedNames = useMemo(
    () => new Set(targets.map((tgt) => tgt.runeword_name)),
    [targets]
  );

  const availableToAdd = useMemo(
    () => recipes.filter((r) => !targetedNames.has(r.name)),
    [recipes, targetedNames]
  );

  const targetProgress = useMemo(() => {
    return targets.map((target) => {
      const recipe = recipes.find((r) => r.name === target.runeword_name);
      if (!recipe) return { target, progress: null };
      const progress = calculateProgress(inventory, recipe);
      return { target, progress };
    });
  }, [targets, recipes, inventory]);

  function handleAdd() {
    if (selectedRuneword) {
      onAddTarget(selectedRuneword);
      setSelectedRuneword("");
    }
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <section className="progress-view" aria-label={t("runes.progress.title", "Progress Tracking")}>
      <h3>{t("runes.progress.title", "Progress Tracking")}</h3>

      {/* Add target controls */}
      <div className="progress-add-target">
        <label htmlFor="add-target-select">
          {t("runes.progress.addTarget", "Add Target")}
        </label>
        <select
          id="add-target-select"
          value={selectedRuneword}
          onChange={(e) => setSelectedRuneword(e.target.value)}
          aria-label={t("runes.progress.selectRuneword", "Select a runeword to track")}
        >
          <option value="">
            {t("runes.progress.selectPlaceholder", "-- Select runeword --")}
          </option>
          {availableToAdd.map((recipe) => (
            <option key={recipe.name} value={recipe.name}>
              {recipe.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          onKeyDown={handleAddKeyDown}
          disabled={!selectedRuneword}
          aria-label={t("runes.progress.addButton", "Add selected runeword as target")}
        >
          {t("runes.progress.add", "Add")}
        </button>
      </div>

      {/* Target list */}
      {targetProgress.length === 0 ? (
        <p className="progress-empty">
          {t("runes.progress.noTargets", "No target runewords selected. Add one above to track your progress.")}
        </p>
      ) : (
        <ul className="progress-list" aria-label={t("runes.progress.targetList", "Target runewords")}>
          {targetProgress.map(({ target, progress }) => {
            if (!progress) return null;

            const percent = Math.round(progress.percentComplete);

            return (
              <li key={target.id} className="progress-item">
                <div className="progress-item-header">
                  <span className="progress-item-name">{target.runeword_name}</span>
                  <span className="progress-item-percent">{percent}%</span>
                  <button
                    type="button"
                    className="progress-remove-btn"
                    onClick={() => onRemoveTarget(target.id)}
                    aria-label={t("runes.progress.removeTarget", "Remove {{name}} from targets", { name: target.runeword_name })}
                  >
                    ✕
                  </button>
                </div>

                {/* Progress bar */}
                <progress
                  className="progress-bar"
                  value={percent}
                  max={100}
                  aria-label={t("runes.progress.completion", "{{name}} completion: {{percent}}%", { name: target.runeword_name, percent })}
                >
                  {percent}%
                </progress>

                {/* Per-rune breakdown */}
                <div className="progress-rune-breakdown">
                  {countRunesForDisplay(progress.runeword.runes).map(({ rune, needed }) => {
                    const have = inventory[rune] ?? 0;
                    const isMissing = have < needed;

                    return (
                      <span
                        key={rune}
                        className={`progress-rune ${isMissing ? "progress-rune-missing" : "progress-rune-complete"}`}
                        title={`${rune}: ${have}/${needed}`}
                      >
                        <span className="progress-rune-name">{rune}</span>
                        <span className="progress-rune-count">
                          {have}/{needed}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Count distinct runes in a recipe for display purposes.
 * Returns an array of { rune, needed } objects (one per distinct rune).
 */
function countRunesForDisplay(runes: string[]): { rune: string; needed: number }[] {
  const counts: Record<string, number> = {};
  for (const rune of runes) {
    counts[rune] = (counts[rune] ?? 0) + 1;
  }
  return Object.entries(counts).map(([rune, needed]) => ({ rune, needed }));
}
