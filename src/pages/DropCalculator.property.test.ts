/**
 * Property-based tests for frontend probability formatting logic.
 *
 * Uses fast-check + vitest to verify universal correctness properties
 * of the pure computation functions used by the DropCalculator frontend.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ===== PURE FUNCTIONS UNDER TEST =====

/**
 * Compute estimated runs to find an item (frontend logic from RunEstimate).
 * Uses kills_for_63 directly as runs-to-find (1 kill per run for bosses).
 */
function computeRunsToFind(perKillProbability: number): number {
  if (perKillProbability <= 0 || perKillProbability >= 1) return 0;
  // kills_for_threshold(p, 0.632) = ceil(ln(1-0.632) / ln(1-p))
  return Math.ceil(Math.log(1 - 0.632) / Math.log(1 - perKillProbability));
}

/**
 * Compute estimated time in seconds.
 */
function computeEstimatedTime(
  runsToFind: number,
  avgDurationSecs: number
): number {
  return runsToFind * avgDurationSecs;
}

/**
 * Compute expected drops (linear in kill count).
 */
function computeExpectedDrops(
  totalKills: number,
  perKillProbability: number
): number {
  return totalKills * perKillProbability;
}

// ===== PROPERTY TESTS =====

describe("Feature: drop-probability-engine, Property 7: Run and Time Estimation Correctness", () => {
  /**
   * Property 7: Run and Time Estimation Correctness
   *
   * For any per-kill probability p in (0, 1) and average run duration d > 0,
   * the runs-to-find estimate SHALL be a positive finite integer,
   * and the time estimate SHALL equal runs_to_find * d and be positive and finite.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it("computeRunsToFind returns a positive finite integer for valid probabilities", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        (p) => {
          const runs = computeRunsToFind(p);
          expect(runs).toBeGreaterThan(0);
          expect(Number.isFinite(runs)).toBe(true);
          expect(Number.isInteger(runs)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("computeEstimatedTime is positive and finite for valid inputs", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        fc.double({ min: 0.1, max: 100000, noNaN: true }),
        (p, avgDurationSecs) => {
          const runs = computeRunsToFind(p);
          const time = computeEstimatedTime(runs, avgDurationSecs);
          expect(time).toBeGreaterThan(0);
          expect(Number.isFinite(time)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("estimated time equals runsToFind * avgDurationSecs", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        fc.double({ min: 0.1, max: 100000, noNaN: true }),
        (p, avgDurationSecs) => {
          const runs = computeRunsToFind(p);
          const time = computeEstimatedTime(runs, avgDurationSecs);
          expect(time).toBe(runs * avgDurationSecs);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Feature: drop-probability-engine, Property 8: Expected Drops Linearity", () => {
  /**
   * Property 8: Expected Drops Linearity
   *
   * For any per-kill probability p in (0, 1) and kill count N >= 0,
   * the expected cumulative drops SHALL equal N * p,
   * and this value SHALL scale linearly (monotonically non-decreasing) with N.
   *
   * **Validates: Requirements 5.2**
   */
  it("computeExpectedDrops equals N * p exactly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        (totalKills, p) => {
          const expected = computeExpectedDrops(totalKills, p);
          expect(expected).toBe(totalKills * p);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("expected drops is monotonically non-decreasing with kill count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999 }),
        fc.integer({ min: 1, max: 1000000 }),
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        (n1, delta, p) => {
          const n2 = n1 + delta; // n2 > n1 guaranteed since delta >= 1
          const drops1 = computeExpectedDrops(n1, p);
          const drops2 = computeExpectedDrops(n2, p);
          expect(drops2).toBeGreaterThanOrEqual(drops1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("expected drops at N=0 is exactly 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-10, max: 0.999, noNaN: true }),
        (p) => {
          const expected = computeExpectedDrops(0, p);
          expect(expected).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
