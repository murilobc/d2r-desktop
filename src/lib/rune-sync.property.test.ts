/**
 * Property-based tests for rune auto-sync with item log.
 *
 * Uses fast-check + vitest to verify that rune inventory correctly
 * increments on item creation and decrements on item deletion.
 *
 * **Validates: Requirements 2.1, 2.2**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { RUNE_ORDER } from "../data/runes";
import { syncRuneOnCreate, syncRuneOnDelete } from "./rune-sync";

vi.mock("../api", () => ({
  updateRuneCount: vi.fn().mockResolvedValue(undefined),
}));

import { updateRuneCount } from "../api";

const mockedUpdateRuneCount = vi.mocked(updateRuneCount);

// ===== GENERATORS =====

/** Generate a valid rune name from the 33 D2R runes. */
const runeNameArb = fc.constantFrom(...RUNE_ORDER);

/** Generate a random profile ID. */
const profileIdArb = fc.string({ minLength: 1, maxLength: 36 });

/** Generate a non-rune item type (anything that is NOT "Rune"). */
const nonRuneItemTypeArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s !== "Rune");

/** Generate a non-rune rarity (anything that is NOT "Rune"). */
const nonRuneRarityArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s !== "Rune");

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner, Property 3: Auto-sync with item log", () => {
  beforeEach(() => {
    mockedUpdateRuneCount.mockClear();
  });

  /**
   * Property 3 - Create: For any valid rune name, calling
   * syncRuneOnCreate(profileId, name + " Rune", "Rune", "Rune")
   * should call updateRuneCount(profileId, name, 1).
   *
   * **Validates: Requirements 2.1**
   */
  it("syncRuneOnCreate calls updateRuneCount with delta +1 for any valid rune item", async () => {
    await fc.assert(
      fc.asyncProperty(profileIdArb, runeNameArb, async (profileId, runeName) => {
        mockedUpdateRuneCount.mockClear();

        await syncRuneOnCreate(profileId, runeName + " Rune", "Rune", "Rune");

        expect(mockedUpdateRuneCount).toHaveBeenCalledOnce();
        expect(mockedUpdateRuneCount).toHaveBeenCalledWith(profileId, runeName, 1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3 - Delete: For any valid rune name, calling
   * syncRuneOnDelete(profileId, name + " Rune", "Rune", "Rune")
   * should call updateRuneCount(profileId, name, -1).
   *
   * **Validates: Requirements 2.2**
   */
  it("syncRuneOnDelete calls updateRuneCount with delta -1 for any valid rune item", async () => {
    await fc.assert(
      fc.asyncProperty(profileIdArb, runeNameArb, async (profileId, runeName) => {
        mockedUpdateRuneCount.mockClear();

        await syncRuneOnDelete(profileId, runeName + " Rune", "Rune", "Rune");

        expect(mockedUpdateRuneCount).toHaveBeenCalledOnce();
        expect(mockedUpdateRuneCount).toHaveBeenCalledWith(profileId, runeName, -1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3 - Non-rune items: For any item with itemType != "Rune"
   * or rarity != "Rune", syncRuneOnCreate should NOT call updateRuneCount.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("syncRuneOnCreate does NOT call updateRuneCount for non-rune items", async () => {
    await fc.assert(
      fc.asyncProperty(
        profileIdArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.oneof(
          // Case 1: wrong itemType (any rarity)
          fc.tuple(nonRuneItemTypeArb, fc.string({ minLength: 1, maxLength: 20 })),
          // Case 2: wrong rarity (any itemType)
          fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), nonRuneRarityArb),
          // Case 3: both wrong
          fc.tuple(nonRuneItemTypeArb, nonRuneRarityArb),
        ),
        async (profileId, itemName, [itemType, rarity]) => {
          mockedUpdateRuneCount.mockClear();

          await syncRuneOnCreate(profileId, itemName, itemType, rarity);

          expect(mockedUpdateRuneCount).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
