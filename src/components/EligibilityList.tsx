import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { calculateEligibility } from "../lib/eligibility-engine";
import type { RuneInventory } from "../lib/eligibility-engine";
import type { RunewordRecipe } from "../data/runewords";

interface EligibilityListProps {
  readonly inventory: RuneInventory;
  readonly recipes: RunewordRecipe[];
}

export default function EligibilityList({ inventory, recipes }: EligibilityListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const results = useMemo(
    () => calculateEligibility(inventory, recipes),
    [inventory, recipes]
  );

  // Sort craftable first, then by percent complete descending
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      if (a.craftable && !b.craftable) return -1;
      if (!a.craftable && b.craftable) return 1;
      return b.percentComplete - a.percentComplete;
    });
  }, [results]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sorted;
    const query = searchQuery.toLowerCase();
    return sorted.filter((r) =>
      r.runeword.name.toLowerCase().includes(query)
    );
  }, [sorted, searchQuery]);

  const craftableCount = results.filter((r) => r.craftable).length;

  return (
    <div className="eligibility-list">
      <div className="eligibility-list-header">
        <h3>
          {t("runewordPlanner.eligibility.title", "Craftable Runewords")}
          <span className="eligibility-count">
            {" "}({craftableCount}/{results.length})
          </span>
        </h3>
        <input
          type="text"
          className="eligibility-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("runewordPlanner.eligibility.searchPlaceholder", "Search runewords...")}
          aria-label={t("runewordPlanner.eligibility.searchLabel", "Search runewords by name")}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="eligibility-empty">
          {searchQuery.trim()
            ? t("runewordPlanner.eligibility.noResults", "No runewords match your search.")
            : t("runewordPlanner.eligibility.noCraftable", "No runewords available yet. Collect more runes!")}
        </p>
      ) : (
        <ul className="eligibility-results">
          {filtered.map((result) => (
            <li
              key={result.runeword.name}
              className={`eligibility-item ${result.craftable ? "craftable" : "partial"}`}
            >
              <div className="eligibility-item-header">
                <span className="eligibility-item-name">{result.runeword.name}</span>
                {result.craftable && (
                  <span className="eligibility-badge">
                    {t("runewordPlanner.eligibility.craftable", "Craftable")}
                  </span>
                )}
                {!result.craftable && (
                  <span className="eligibility-percent">
                    {Math.round(result.percentComplete)}%
                  </span>
                )}
              </div>
              <div className="eligibility-item-details">
                <span className="eligibility-runes">
                  {result.runeword.runes.join(" + ")}
                </span>
                <span className="eligibility-meta">
                  {result.runeword.sockets} {t("runewordPlanner.eligibility.sockets", "sockets")}
                  {" · "}
                  {result.runeword.bases.join(", ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
