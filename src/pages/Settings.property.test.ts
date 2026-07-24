/**
 * Property-based tests for hotkey configuration persistence.
 *
 * Uses fast-check + vitest to verify that the hotkey save/load round-trip
 * is lossless for any valid HotkeyConfig object.
 *
 * Feature: screenshot-detect-ux, Property 1: Hotkey configuration persistence round-trip
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mirror the constants from Settings.tsx (not exported)
const DEFAULT_HOTKEYS = {
  nextRun: "F9",
  pause: "F10",
  endSession: "F11",
  detectScreenshot: "",
};

type HotkeyConfig = typeof DEFAULT_HOTKEYS;

const STORAGE_KEY = "d2r_hotkeys";

// Replicates loadHotkeys() from Settings.tsx
function loadHotkeys(): HotkeyConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_HOTKEYS, ...JSON.parse(stored) };
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_HOTKEYS;
}

// Replicates saveHotkeys() from Settings.tsx
function saveHotkeys(config: HotkeyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ===== GENERATORS =====

/** Generate a valid hotkey value: empty string or modifier+key combination */
const hotkeyValueArb = fc.oneof(
  fc.constant(""), // empty/unset
  fc.constantFrom("F9", "F10", "F11", "F12"), // function keys
  fc
    .tuple(
      fc.subarray(["Ctrl", "Alt", "Shift"], { minLength: 1 }),
      fc.constantFrom("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    )
    .map(([mods, key]) => [...mods, key].join("+")) // modifier combos
);

/** Generate a valid HotkeyConfig with 4 string fields */
const hotkeyConfigArb: fc.Arbitrary<HotkeyConfig> = fc.record({
  nextRun: hotkeyValueArb,
  pause: hotkeyValueArb,
  endSession: hotkeyValueArb,
  detectScreenshot: hotkeyValueArb,
});

// ===== PROPERTY TESTS =====

describe("Feature: screenshot-detect-ux, Property 1: Hotkey configuration persistence round-trip", () => {
  /**
   * Property 1: Hotkey configuration persistence round-trip
   *
   * For any valid HotkeyConfig object (where each field is either an empty string
   * or a non-empty key combination string composed of modifier prefixes and a key name),
   * saving the config via saveHotkeys and then loading it via loadHotkeys SHALL produce
   * an identical HotkeyConfig value.
   *
   * **Validates: Requirements 4.6**
   */

  beforeEach(() => {
    localStorage.clear();
  });

  it("saveHotkeys → loadHotkeys produces identical config", () => {
    fc.assert(
      fc.property(hotkeyConfigArb, (config) => {
        // Save the config
        saveHotkeys(config);

        // Load it back
        const loaded = loadHotkeys();

        // Round-trip must be lossless
        expect(loaded).toEqual(config);
      }),
      { numRuns: 100 }
    );
  });
});
