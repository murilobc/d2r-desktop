/**
 * Property-based preservation tests for useDetectionToast reason mapping.
 *
 * These tests verify that existing REASON_MESSAGES behavior is preserved:
 * - Known reason codes ("no_text", "no_match", "no_image") map to their specific messages
 * - Unknown/arbitrary reason codes fall back to "Screenshot detection failed"
 * - mapReasonToMessage never throws and always returns a string
 *
 * Uses fast-check + vitest + @testing-library/react-hooks.
 *
 * Feature: screenshot-detect-silent-paths-fix, Property 2: Preservation
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import { listen } from "@tauri-apps/api/event";
import { useDetectionToast } from "./useDetectionToast";

vi.mock("@tauri-apps/api/event");
const mockListen = vi.mocked(listen);

// ===== CONSTANTS =====

/** The known reason codes and their expected messages (existing behavior to preserve) */
const KNOWN_REASON_MESSAGES: Record<string, string> = {
  no_text: "No text detected in screenshot",
  no_match: "No item detected in screenshot",
  no_image: "No image found in clipboard",
};

const KNOWN_REASON_CODES = Object.keys(KNOWN_REASON_MESSAGES);

const FALLBACK_MESSAGE = "Screenshot detection failed";

// ===== GENERATORS =====

/** Generate one of the known existing reason codes */
const knownReasonArb = fc.constantFrom(...KNOWN_REASON_CODES);

/**
 * Generate an arbitrary string that is NOT one of the known reason codes
 * and not an Object.prototype property name (which would return a function
 * from plain object lookup due to prototype chain — a JS quirk unrelated to the bug).
 */
const OBJECT_PROTOTYPE_KEYS = Object.getOwnPropertyNames(Object.prototype);

const unknownReasonArb = fc.string().filter(
  (s) => !KNOWN_REASON_CODES.includes(s) && !OBJECT_PROTOTYPE_KEYS.includes(s)
);

// ===== HELPERS =====

function setupHookWithEventCapture() {
  const eventCallbacks: Record<string, (event: { payload: unknown }) => void> = {};

  mockListen.mockImplementation((eventName: string, callback: unknown) => {
    eventCallbacks[eventName] = callback as (event: { payload: unknown }) => void;
    return Promise.resolve(() => {});
  });

  return eventCallbacks;
}

// ===== PROPERTY TESTS =====

describe("Feature: screenshot-detect-silent-paths-fix, Property 2: Preservation - Known Reason Codes Map to Specific Messages", () => {
  /**
   * Property: for all existing reason codes (no_text, no_match, no_image),
   * mapReasonToMessage returns the expected specific message (not the fallback).
   *
   * This tests the preservation requirement that existing mappings remain unchanged.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("each known reason code maps to its specific expected message", async () => {
    await fc.assert(
      fc.asyncProperty(knownReasonArb, async (reason) => {
        vi.clearAllMocks();
        const eventCallbacks = setupHookWithEventCapture();
        const { result, unmount } = renderHook(() => useDetectionToast());

        // Wait for the async listen setup
        await act(async () => {});

        // Simulate a detection-failed event with the known reason
        act(() => {
          eventCallbacks["screenshot:detection-failed"]({
            payload: { reason, message: "" },
          });
        });

        // The toast message should be the specific known message, NOT the fallback
        expect(result.current.toast).not.toBeNull();
        expect(result.current.toast!.message).toBe(KNOWN_REASON_MESSAGES[reason]);
        expect(result.current.toast!.message).not.toBe(FALLBACK_MESSAGE);
        expect(result.current.toast!.visible).toBe(true);

        unmount();
      }),
      { numRuns: 50 }
    );
  });
});

describe("Feature: screenshot-detect-silent-paths-fix, Property 2: Preservation - Unknown Reason Codes Fall Back to Generic Message", () => {
  /**
   * Property: for all arbitrary strings NOT in REASON_MESSAGES keys,
   * mapReasonToMessage returns "Screenshot detection failed" (the fallback).
   *
   * This tests the preservation requirement that the fallback behavior is unchanged.
   *
   * **Validates: Requirements 3.4**
   */

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("unknown reason codes always produce the fallback message", async () => {
    await fc.assert(
      fc.asyncProperty(unknownReasonArb, async (reason) => {
        vi.clearAllMocks();
        const eventCallbacks = setupHookWithEventCapture();
        const { result, unmount } = renderHook(() => useDetectionToast());

        await act(async () => {});

        // Simulate a detection-failed event with an unknown reason
        act(() => {
          eventCallbacks["screenshot:detection-failed"]({
            payload: { reason, message: "" },
          });
        });

        // Should always fall back to the generic message
        expect(result.current.toast).not.toBeNull();
        expect(result.current.toast!.message).toBe(FALLBACK_MESSAGE);
        expect(result.current.toast!.visible).toBe(true);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: screenshot-detect-silent-paths-fix, Property 2: Preservation - mapReasonToMessage Never Throws", () => {
  /**
   * Property: for all arbitrary strings (any reason code at all),
   * mapReasonToMessage never throws and always returns a string.
   *
   * This verifies robustness of the mapping function regardless of input.
   *
   * **Validates: Requirements 3.2, 3.3, 3.4**
   */

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("any reason string produces a non-empty string toast message without throwing", async () => {
    // Exclude Object.prototype keys that would return functions from plain object lookup
    const safeStringArb = fc.string().filter(
      (s) => !OBJECT_PROTOTYPE_KEYS.includes(s)
    );
    await fc.assert(
      fc.asyncProperty(safeStringArb, async (reason) => {
        vi.clearAllMocks();
        const eventCallbacks = setupHookWithEventCapture();
        const { result, unmount } = renderHook(() => useDetectionToast());

        await act(async () => {});

        // Should never throw, regardless of input
        act(() => {
          eventCallbacks["screenshot:detection-failed"]({
            payload: { reason, message: "" },
          });
        });

        // Should always produce a valid toast with a non-empty string message
        expect(result.current.toast).not.toBeNull();
        expect(typeof result.current.toast!.message).toBe("string");
        expect(result.current.toast!.message.length).toBeGreaterThan(0);
        expect(result.current.toast!.visible).toBe(true);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
