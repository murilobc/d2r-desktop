/**
 * Property-based tests for the Cube Engine upgrade path calculator.
 *
 * Uses fast-check + vitest to verify universal correctness properties
 * across randomly generated inputs.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateUpgradePath } from "./cube-engine";
import { RUNE_DEFINITIONS } from "../data/runes";
import type { RuneInventory } from "./eligibility-engine";

// ===== GENERATORS =====

/** All runes with level > 1 (valid targets for upgrade path calculation). */
const targetRunesAboveLevel1 = RUNE_DEFINITIONS.filter((r) => r.level > 1);

/** Generate an arbitrary target rune with level > 1. */
const targetRuneArb = fc.constantFrom(...targetRunesAboveLevel1.map((r) => r.name));

/**
 * Generate a non-empty inventory containing at least one rune that appears
 * in the upgrade path to a given target rune (i.e., a rune with level < target level).
 */
function inventoryWithPathRuneArb(targetRuneName: string): fc.Arbitrary<RuneInventory> {
  const targetDef = RUNE_DEFINITIONS.find((r) => r.name === targetRuneName)!;
  // Runes that are below the target level (appear in the upgrade path)
  const pathRunes = RUNE_DEFINITIONS.filter((r) => r.level < targetDef.level);

  // Pick at least one rune from the path and give it a positive count
  return fc
    .record({
      // At least one rune from the path with count >= 1
      pathRune: fc.constantFrom(...pathRunes.map((r) => r.name)),
      pathCount: fc.integer({ min: 1, max: 10 }),
      // Additional random runes (may or may not be in path)
      extras: fc.array(
        fc.tuple(
          fc.constantFrom(...RUNE_DEFINITIONS.map((r) => r.name)),
          fc.integer({ min: 0, max: 10 })
        ),
        { minLength: 0, maxLength: 5 }
      ),
    })
    .map(({ pathRune, pathCount, extras }) => {
      const inv: RuneInventory = {};
      inv[pathRune] = pathCount;
      for (const [name, count] of extras) {
        // Don't overwrite the guaranteed path rune with zero
        if (name === pathRune) {
          inv[name] = Math.max(inv[name] ?? 0, count);
        } else {
          inv[name] = count;
        }
      }
      return inv;
    });
}

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner, Property 7: Inventory reduces cube path cost", () => {
  /**
   * Property 7: Inventory reduces cube path cost (metamorphic)
   *
   * For any target rune and any non-empty inventory containing at least one rune
   * that appears in the upgrade path, the total base runes needed SHALL be strictly
   * less than or equal to the total needed with an empty inventory.
   *
   * **Validates: Requirements 6.4**
   */
  it("totalBaseRunes with non-empty inventory is <= totalBaseRunes with empty inventory", () => {
    fc.assert(
      fc.property(
        targetRuneArb.chain((target) =>
          fc.tuple(fc.constant(target), inventoryWithPathRuneArb(target))
        ),
        ([targetRune, inventory]) => {
          const emptyInventory: RuneInventory = {};

          const pathWithInventory = calculateUpgradePath(targetRune, inventory);
          const pathWithEmpty = calculateUpgradePath(targetRune, emptyInventory);

          expect(pathWithInventory.totalBaseRunes).toBeLessThanOrEqual(
            pathWithEmpty.totalBaseRunes
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
