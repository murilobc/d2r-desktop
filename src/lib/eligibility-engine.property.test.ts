/**
 * Property-based tests for the eligibility engine.
 *
 * Uses fast-check + vitest to verify universal correctness properties
 * across randomly generated inputs.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateProgress } from "./eligibility-engine";
import type { RuneInventory } from "./eligibility-engine";
import type { RunewordRecipe } from "../data/runewords";
import { RUNE_ORDER } from "../data/runes";

// ===== GENERATORS =====

/** Generate a valid rune name from the 33 D2R runes. */
const runeNameArb = fc.constantFrom(...RUNE_ORDER);

/** Generate a non-empty rune list (1-6 runes, may contain duplicates). */
const runeListArb = fc.array(runeNameArb, { minLength: 1, maxLength: 6 });

/** Generate a valid RunewordRecipe with arbitrary rune composition. */
const recipeArb: fc.Arbitrary<RunewordRecipe> = runeListArb.chain((runes) =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    runes: fc.constant(runes),
    bases: fc.constant(["weapon"]),
    sockets: fc.constant(runes.length),
  }),
);

/** Generate a RuneInventory with arbitrary non-negative counts for a subset of runes. */
const inventoryArb: fc.Arbitrary<RuneInventory> = fc
  .array(
    fc.tuple(runeNameArb, fc.integer({ min: 0, max: 10 })),
    { minLength: 0, maxLength: 33 },
  )
  .map((pairs) => {
    const inv: RuneInventory = {};
    for (const [rune, count] of pairs) {
      inv[rune] = (inv[rune] ?? 0) + count;
    }
    return inv;
  });

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner, Property 5: Progress calculation accuracy", () => {
  /**
   * Property 5: Progress calculation accuracy
   *
   * For any rune inventory and any runeword recipe, the progress calculation SHALL produce:
   * (a) a percentComplete equal to (sum of min(have, needed) for each distinct rune / sum of needed) × 100
   * (b) a missingRunes list containing exactly those runes where have < needed
   * (c) for each rune in the recipe, correct needed and have values
   *
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it("percentComplete matches oracle formula: (sum of min(have, needed) / sum of needed) × 100", () => {
    fc.assert(
      fc.property(inventoryArb, recipeArb, (inventory, recipe) => {
        const result = calculateProgress(inventory, recipe);

        // Compute expected percentComplete independently
        const runeCounts: Record<string, number> = {};
        for (const rune of recipe.runes) {
          runeCounts[rune] = (runeCounts[rune] ?? 0) + 1;
        }

        let totalNeeded = 0;
        let totalHave = 0;
        for (const [rune, needed] of Object.entries(runeCounts)) {
          const have = inventory[rune] ?? 0;
          totalNeeded += needed;
          totalHave += Math.min(have, needed);
        }

        const expectedPercent = totalNeeded === 0 ? 100 : (totalHave / totalNeeded) * 100;

        expect(result.percentComplete).toBeCloseTo(expectedPercent, 10);
      }),
      { numRuns: 100 },
    );
  });

  it("missingRunes contains exactly those runes where have < needed", () => {
    fc.assert(
      fc.property(inventoryArb, recipeArb, (inventory, recipe) => {
        const result = calculateProgress(inventory, recipe);

        // Compute expected missing runes independently
        const runeCounts: Record<string, number> = {};
        for (const rune of recipe.runes) {
          runeCounts[rune] = (runeCounts[rune] ?? 0) + 1;
        }

        const expectedMissing: { rune: string; needed: number; have: number }[] = [];
        for (const [rune, needed] of Object.entries(runeCounts)) {
          const have = inventory[rune] ?? 0;
          if (have < needed) {
            expectedMissing.push({ rune, needed, have });
          }
        }

        // Same count of missing runes
        expect(result.missingRunes.length).toBe(expectedMissing.length);

        // Same set of runes (order may differ)
        const sortByRune = (a: { rune: string }, b: { rune: string }) =>
          a.rune.localeCompare(b.rune);
        const sortedResult = [...result.missingRunes].sort(sortByRune);
        const sortedExpected = [...expectedMissing].sort(sortByRune);

        expect(sortedResult).toEqual(sortedExpected);
      }),
      { numRuns: 100 },
    );
  });

  it("missingRunes entries have correct needed and have values for each rune", () => {
    fc.assert(
      fc.property(inventoryArb, recipeArb, (inventory, recipe) => {
        const result = calculateProgress(inventory, recipe);

        // Compute rune counts from recipe
        const runeCounts: Record<string, number> = {};
        for (const rune of recipe.runes) {
          runeCounts[rune] = (runeCounts[rune] ?? 0) + 1;
        }

        for (const entry of result.missingRunes) {
          const expectedNeeded = runeCounts[entry.rune];
          const expectedHave = inventory[entry.rune] ?? 0;

          expect(entry.needed).toBe(expectedNeeded);
          expect(entry.have).toBe(expectedHave);
          // Confirm it's actually missing
          expect(entry.have).toBeLessThan(entry.needed);
        }
      }),
      { numRuns: 100 },
    );
  });
});
