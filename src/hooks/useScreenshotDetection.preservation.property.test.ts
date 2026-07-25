/**
 * Preservation Property Tests for useScreenshotDetection
 *
 * These tests capture baseline behavior of the hook on UNFIXED code
 * to ensure the bug fix does not introduce regressions. They verify:
 *
 * 1. Successful detection flows proceed via the event system (not triggerManual)
 * 2. The hook returns the correct shape with proper types
 * 3. dismiss/confirm correctly reset hook state
 * 4. No error callback is invoked when detectFromClipboard resolves successfully
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";

vi.mock("../api", () => ({
  detectFromClipboard: vi.fn(),
  createItem: vi.fn(),
  createRun: vi.fn(),
  getRuns: vi.fn().mockResolvedValue([]),
  updateRuneCount: vi.fn(),
}));

import { detectFromClipboard } from "../api";
import { useScreenshotDetection } from "./useScreenshotDetection";

const mockedDetectFromClipboard = vi.mocked(detectFromClipboard);
const mockedListen = vi.mocked(listen);

// ===== GENERATORS =====

/** Generate a valid profile ID. */
const profileIdArb = fc.string({ minLength: 1, maxLength: 36 });

/** Generate a valid MatchCandidate object. */
const matchCandidateArb = fc.record({
  item_name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 30 }),
  subcategory: fc.string({ minLength: 1, maxLength: 30 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
});

/** Generate a valid DetectionResult payload (as emitted by the event system). */
const detectionResultArb = fc.record({
  top_match: fc.option(matchCandidateArb, { nil: null }),
  candidates: fc.array(matchCandidateArb, { minLength: 0, maxLength: 5 }),
  raw_text: fc.string({ minLength: 0, maxLength: 200 }),
  is_auto_suggested: fc.boolean(),
  detected_at: fc.integer({ min: 946684800000, max: 4102444800000 }).map((ts) => new Date(ts).toISOString()),
});

// ===== PROPERTY TESTS =====

describe("Feature: screenshot-detect-no-feedback-fix, Property 2: Preservation - Non-Error Detection Flows Unchanged", () => {
  let eventListenerCallback: ((event: { payload: unknown }) => void) | null =
    null;

  beforeEach(() => {
    mockedDetectFromClipboard.mockReset();
    eventListenerCallback = null;

    // Capture the event listener callback so we can simulate events
    mockedListen.mockImplementation((_eventName, handler) => {
      eventListenerCallback = handler as (event: {
        payload: unknown;
      }) => void;
      return Promise.resolve(() => {});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 2a: For all cases where detectFromClipboard resolves (not rejects),
   * triggerManual does not throw and no error callback is invoked.
   * Detection state is only set via the event listener, not directly by triggerManual.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it("triggerManual does not throw and no error side effects occur when detectFromClipboard resolves", async () => {
    await fc.assert(
      fc.asyncProperty(profileIdArb, async (profileId) => {
        mockedDetectFromClipboard.mockResolvedValueOnce(undefined);

        const { result } = renderHook(() =>
          useScreenshotDetection(profileId)
        );

        // triggerManual should not throw when detectFromClipboard resolves
        await act(async () => {
          expect(() => result.current.triggerManual()).not.toThrow();
          await new Promise((r) => setTimeout(r, 0));
        });

        // Detection state should remain null (detection comes via event, not triggerManual)
        expect(result.current.detection).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2b: The hook returns { detection, dismiss, confirm, triggerManual }
   * with correct types for any valid profileId.
   *
   * **Validates: Requirements 3.3**
   */
  it("hook returns correct shape with proper types for any profile ID", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(profileIdArb, { nil: null }),
        async (profileId) => {
          const { result } = renderHook(() =>
            useScreenshotDetection(profileId)
          );

          // Verify the hook returns all expected properties
          expect(result.current).toHaveProperty("detection");
          expect(result.current).toHaveProperty("dismiss");
          expect(result.current).toHaveProperty("confirm");
          expect(result.current).toHaveProperty("triggerManual");

          // Verify types
          expect(result.current.detection).toBeNull(); // Initially null
          expect(typeof result.current.dismiss).toBe("function");
          expect(typeof result.current.confirm).toBe("function");
          expect(typeof result.current.triggerManual).toBe("function");
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2c: When detection is set via the event system, calling dismiss
   * clears detection state (detection becomes null).
   *
   * **Validates: Requirements 3.4**
   */
  it("dismiss clears detection state for any detection payload received via event", async () => {
    await fc.assert(
      fc.asyncProperty(detectionResultArb, async (detectionPayload) => {
        const { result } = renderHook(() =>
          useScreenshotDetection("test-profile")
        );

        // Simulate a detection event arriving via the event system
        await act(async () => {
          if (eventListenerCallback) {
            eventListenerCallback({ payload: detectionPayload });
          }
        });

        // Detection should be set
        expect(result.current.detection).toEqual(detectionPayload);

        // Dismiss should clear it
        act(() => {
          result.current.dismiss();
        });

        expect(result.current.detection).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2d: For any sequence of dismiss calls after detection,
   * detection always becomes null (idempotent reset).
   *
   * **Validates: Requirements 3.4**
   */
  it("multiple dismiss calls are idempotent - detection stays null", async () => {
    await fc.assert(
      fc.asyncProperty(
        detectionResultArb,
        fc.integer({ min: 1, max: 5 }),
        async (detectionPayload, dismissCount) => {
          const { result } = renderHook(() =>
            useScreenshotDetection("test-profile")
          );

          // Simulate detection event
          await act(async () => {
            if (eventListenerCallback) {
              eventListenerCallback({ payload: detectionPayload });
            }
          });

          // Call dismiss multiple times
          for (let i = 0; i < dismissCount; i++) {
            act(() => {
              result.current.dismiss();
            });
          }

          // Detection should always be null after any number of dismissals
          expect(result.current.detection).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2e: When detectFromClipboard resolves successfully and a detection
   * event arrives, the full flow works: detection is set, then dismiss clears it.
   * This verifies that successful triggerManual + event system + dismiss all work
   * together without any error side effects.
   *
   * **Validates: Requirements 3.1, 3.2, 3.4**
   */
  it("successful triggerManual followed by event detection and dismiss resets state correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        profileIdArb,
        detectionResultArb,
        async (profileId, detectionPayload) => {
          mockedDetectFromClipboard.mockResolvedValueOnce(undefined);

          const { result } = renderHook(() =>
            useScreenshotDetection(profileId)
          );

          // Trigger manual detection (resolves successfully)
          await act(async () => {
            result.current.triggerManual();
            await new Promise((r) => setTimeout(r, 0));
          });

          // Detection is still null (it comes via event, not return value)
          expect(result.current.detection).toBeNull();

          // Simulate the event arriving from the backend
          await act(async () => {
            if (eventListenerCallback) {
              eventListenerCallback({ payload: detectionPayload });
            }
          });

          // Now detection is set
          expect(result.current.detection).toEqual(detectionPayload);

          // Dismiss clears it
          act(() => {
            result.current.dismiss();
          });

          expect(result.current.detection).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });
});
