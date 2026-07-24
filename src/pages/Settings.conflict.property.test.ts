/**
 * Property-based test for hotkey conflict detection.
 *
 * Uses fast-check + vitest to verify that the hasHotkeyConflict function
 * correctly rejects duplicate hotkey bindings across all valid input states.
 */

// Feature: screenshot-detect-ux, Property 2: Hotkey conflict detection prevents duplicate bindings

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { hasHotkeyConflict } from "./Settings";

describe("Feature: screenshot-detect-ux, Property 2: Hotkey conflict detection prevents duplicate bindings", () => {
  /**
   * Property 2: Hotkey conflict detection prevents duplicate bindings
   *
   * For any hotkey configuration state and any non-empty key combination string K,
   * if K is already assigned to one hotkey slot, attempting to assign K to a different
   * slot SHALL be rejected by hasHotkeyConflict returning true.
   *
   * **Validates: Requirements 4.9**
   */

  const SLOTS = ["nextRun", "pause", "endSession", "detectScreenshot"] as const;

  const hotkeyValueArb = fc.oneof(
    fc.constant(""),
    fc.constantFrom("F9", "F10", "F11", "F12"),
    fc.tuple(
      fc.subarray(["Ctrl", "Alt", "Shift"], { minLength: 1 }),
      fc.constantFrom("A", "B", "C", "D", "E", "F", "G")
    ).map(([mods, key]) => [...mods, key].join("+"))
  );

  const hotkeyConfigArb = fc.record({
    nextRun: hotkeyValueArb,
    pause: hotkeyValueArb,
    endSession: hotkeyValueArb,
    detectScreenshot: hotkeyValueArb,
  });

  it("for any non-empty key K already assigned to one slot, assigning K to a different slot is rejected", () => {
    fc.assert(
      fc.property(
        hotkeyConfigArb,
        fc.constantFrom(...SLOTS),
        fc.constantFrom(...SLOTS),
        (config, sourceSlot, targetSlot) => {
          const key = config[sourceSlot];
          // Only test when: key is non-empty AND source and target are different slots
          fc.pre(key !== "" && sourceSlot !== targetSlot);

          // The conflict detector should reject assigning key to targetSlot
          const hasConflict = hasHotkeyConflict(config, targetSlot, key);
          expect(hasConflict).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("assigning an empty string never reports a conflict", () => {
    fc.assert(
      fc.property(
        hotkeyConfigArb,
        fc.constantFrom(...SLOTS),
        (config, targetSlot) => {
          const hasConflict = hasHotkeyConflict(config, targetSlot, "");
          expect(hasConflict).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

});
