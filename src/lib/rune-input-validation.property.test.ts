/**
 * Property-based tests for the rune count input validation utility.
 *
 * Uses fast-check + vitest to verify universal correctness properties
 * across randomly generated inputs.
 */

// Feature: runeword-planner-ui-refinement, Property 5: Input validation accepts valid integers and rejects invalid strings

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateRuneCountInput } from "./rune-input-validation";

// ===== GENERATORS =====

/** Generate a valid integer string in [0, 99]. */
const validIntegerStringArb = fc.integer({ min: 0, max: 99 }).map((n) => n.toString());

/** Generate an integer string greater than 99. */
const tooLargeIntegerStringArb = fc.integer({ min: 100, max: 999999 }).map((n) => n.toString());

/** Generate a negative number string. */
const negativeStringArb = fc.integer({ min: -999999, max: -1 }).map((n) => n.toString());

/** Generate a decimal number string. */
const decimalStringArb = fc
  .tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 1, max: 99 }))
  .map(([whole, frac]) => `${whole}.${frac}`);

/** Generate a non-numeric string (contains at least one non-digit character, not empty). */
const nonNumericStringArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.length > 0 && !/^\d+$/.test(s));

// ===== PROPERTY TESTS =====

/**
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */
describe("Feature: runeword-planner-ui-refinement, Property 5: Input validation accepts valid integers and rejects invalid strings", () => {
  it("accepts valid integers in [0, 99] and returns the parsed number", () => {
    fc.assert(
      fc.property(validIntegerStringArb, (input) => {
        const result = validateRuneCountInput(input);
        const expected = Number(input);

        expect(result).toBe(expected);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(99);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects empty strings by returning null", () => {
    const result = validateRuneCountInput("");
    expect(result).toBeNull();
  });

  it("rejects integers greater than 99 by returning null", () => {
    fc.assert(
      fc.property(tooLargeIntegerStringArb, (input) => {
        const result = validateRuneCountInput(input);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("rejects negative number strings by returning null", () => {
    fc.assert(
      fc.property(negativeStringArb, (input) => {
        const result = validateRuneCountInput(input);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("rejects decimal number strings by returning null", () => {
    fc.assert(
      fc.property(decimalStringArb, (input) => {
        const result = validateRuneCountInput(input);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("rejects non-numeric strings by returning null", () => {
    fc.assert(
      fc.property(nonNumericStringArb, (input) => {
        const result = validateRuneCountInput(input);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("for any arbitrary string, returns either a valid number in [0, 99] or null", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 20 }), (input) => {
        const result = validateRuneCountInput(input);

        if (result !== null) {
          // If a number is returned, it must be a valid integer in [0, 99]
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(99);
          // And the input must be a pure digit string representing that number
          expect(/^\d+$/.test(input)).toBe(true);
          expect(Number(input)).toBe(result);
        } else {
          // If null is returned, the input must be invalid:
          // empty, non-digit characters, or represents a number > 99
          const isEmptyOrNonDigit = input === "" || !/^\d+$/.test(input);
          const isOutOfRange = /^\d+$/.test(input) && Number(input) > 99;
          expect(isEmptyOrNonDigit || isOutOfRange).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});
