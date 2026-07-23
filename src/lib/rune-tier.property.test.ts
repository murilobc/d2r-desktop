/**
 * Property-based tests for the rune tier classification utility.
 *
 * Uses fast-check + vitest to verify tier classification correctness
 * across randomly generated (level, count) pairs.
 */

// Feature: runeword-planner-ui-refinement, Property 1: Tier classification is consistent with rune level and count

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { classifyRuneCell } from "./rune-tier";

// ===== GENERATORS =====

/** Generate a rune level in the valid range [1, 33]. */
const runeLevelArb = fc.integer({ min: 1, max: 33 });

/** Generate a rune count in the valid range [0, 99]. */
const runeCountArb = fc.integer({ min: 0, max: 99 });

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner-ui-refinement, Property 1: Tier classification is consistent with rune level and count", () => {
  /**
   * Property 1: Tier classification is consistent with rune level and count
   *
   * For any rune definition (with level 1–33) and for any count value (0–99),
   * classifyRuneCell(level, count) SHALL return:
   * - borderClass containing "high" if and only if level >= 21
   * - countColorClass containing "success" if and only if level >= 21 && level <= 29 && count > 0
   * - countColorClass containing "unique" if and only if level >= 30 && count > 0
   * - countColorClass being empty when count === 0 or level < 21
   * - isZero being true if and only if count === 0
   *
   * **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.4**
   */
  it("borderClass contains 'high' if and only if level >= 21", () => {
    fc.assert(
      fc.property(runeLevelArb, runeCountArb, (level, count) => {
        const result = classifyRuneCell(level, count);

        if (level >= 21) {
          expect(result.borderClass).toContain("high");
        } else {
          expect(result.borderClass).not.toContain("high");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("countColorClass contains 'success' if and only if level 21–29 and count > 0", () => {
    fc.assert(
      fc.property(runeLevelArb, runeCountArb, (level, count) => {
        const result = classifyRuneCell(level, count);

        if (level >= 21 && level <= 29 && count > 0) {
          expect(result.countColorClass).toContain("success");
        } else {
          expect(result.countColorClass).not.toContain("success");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("countColorClass contains 'unique' if and only if level >= 30 and count > 0", () => {
    fc.assert(
      fc.property(runeLevelArb, runeCountArb, (level, count) => {
        const result = classifyRuneCell(level, count);

        if (level >= 30 && count > 0) {
          expect(result.countColorClass).toContain("unique");
        } else {
          expect(result.countColorClass).not.toContain("unique");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("countColorClass is empty when count === 0 or level < 21", () => {
    fc.assert(
      fc.property(runeLevelArb, runeCountArb, (level, count) => {
        const result = classifyRuneCell(level, count);

        if (count === 0 || level < 21) {
          expect(result.countColorClass).toBe("");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("isZero is true if and only if count === 0", () => {
    fc.assert(
      fc.property(runeLevelArb, runeCountArb, (level, count) => {
        const result = classifyRuneCell(level, count);

        if (count === 0) {
          expect(result.isZero).toBe(true);
        } else {
          expect(result.isZero).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
