// Runeword eligibility and progress calculation engine
// Pure functions that compare a rune inventory against runeword recipes

import type { RunewordRecipe } from "../data/runewords";

export type RuneInventory = Record<string, number>;

export interface EligibilityResult {
  runeword: RunewordRecipe;
  craftable: boolean;
  percentComplete: number; // 0-100
  missingRunes: { rune: string; needed: number; have: number }[];
}

/**
 * Count the occurrences of each rune in a recipe's rune list.
 * Handles duplicates (e.g. Infinity requires 2x Ber).
 */
function countRunesInRecipe(runes: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rune of runes) {
    counts[rune] = (counts[rune] ?? 0) + 1;
  }
  return counts;
}

/**
 * Calculate eligibility for all recipes against the given inventory.
 * A runeword is "craftable" iff for every rune in its recipe,
 * the inventory count >= the number of times that rune appears.
 */
export function calculateEligibility(
  inventory: RuneInventory,
  recipes: RunewordRecipe[]
): EligibilityResult[] {
  return recipes.map((recipe) => calculateProgress(inventory, recipe));
}

/**
 * Calculate progress toward a single runeword recipe.
 * - percentComplete = (sum of min(have, needed) for each distinct rune / sum of needed) × 100
 * - missingRunes = those runes where have < needed
 */
export function calculateProgress(
  inventory: RuneInventory,
  recipe: RunewordRecipe
): EligibilityResult {
  const runeCounts = countRunesInRecipe(recipe.runes);
  const missingRunes: { rune: string; needed: number; have: number }[] = [];

  let totalNeeded = 0;
  let totalHave = 0;

  for (const [rune, needed] of Object.entries(runeCounts)) {
    const have = inventory[rune] ?? 0;
    totalNeeded += needed;
    totalHave += Math.min(have, needed);

    if (have < needed) {
      missingRunes.push({ rune, needed, have });
    }
  }

  const percentComplete =
    totalNeeded === 0 ? 100 : (totalHave / totalNeeded) * 100;
  const craftable = missingRunes.length === 0;

  return {
    runeword: recipe,
    craftable,
    percentComplete,
    missingRunes,
  };
}
