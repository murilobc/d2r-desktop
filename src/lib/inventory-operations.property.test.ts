/**
 * Property-based tests for inventory operations.
 *
 * Uses fast-check + vitest to verify that the clamped-addition logic
 * preserves invariants across arbitrary sequences of increment/decrement operations.
 *
 * Feature: runeword-planner, Property 1: Inventory operations preserve invariants
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ===== PURE FUNCTION UNDER TEST =====

/**
 * Applies a sequence of deltas to an initial rune count,
 * clamping at zero after each operation.
 *
 * This mirrors the backend behavior: each increment/decrement
 * is applied individually with MAX(0, count + delta).
 */
export function applyDeltas(initial: number, deltas: number[]): number {
  let count = initial;
  for (const delta of deltas) {
    count = Math.max(0, count + delta);
  }
  return count;
}

// ===== GENERATORS =====

/** Generate a non-negative initial count (typical inventory range). */
const initialCountArb = fc.integer({ min: 0, max: 100 });

/** Generate arbitrary deltas (mix of increments and decrements). */
const deltasArb = fc.array(fc.integer({ min: -50, max: 50 }), {
  minLength: 0,
  maxLength: 50,
});

/** Generate positive-only deltas (only increments). */
const positiveDeltasArb = fc.array(fc.integer({ min: 1, max: 20 }), {
  minLength: 0,
  maxLength: 50,
});

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner, Property 1: Inventory operations preserve invariants", () => {
  /**
   * Property 1: Inventory operations preserve invariants
   *
   * For any rune inventory and any sequence of increment/decrement operations,
   * the resulting count SHALL always be >= 0. No operation shall cause any count
   * to become negative.
   *
   * **Validates: Requirements 1.3, 1.4, 1.5**
   */
  it("for any initial count and any sequence of deltas, the final count is always >= 0", () => {
    fc.assert(
      fc.property(initialCountArb, deltasArb, (initial, deltas) => {
        const result = applyDeltas(initial, deltas);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("for any initial count and positive-only deltas, final count = initial + sum(deltas)", () => {
    fc.assert(
      fc.property(initialCountArb, positiveDeltasArb, (initial, deltas) => {
        const result = applyDeltas(initial, deltas);
        const expectedSum = initial + deltas.reduce((acc, d) => acc + d, 0);
        expect(result).toBe(expectedSum);
      }),
      { numRuns: 100 },
    );
  });

  it("for any sequence starting at 0 that sums negative, final count >= 0 (clamping property)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -20, max: 10 }), {
          minLength: 1,
          maxLength: 50,
        }).filter((deltas) => deltas.reduce((a, b) => a + b, 0) < 0),
        (deltas) => {
          const result = applyDeltas(0, deltas);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
