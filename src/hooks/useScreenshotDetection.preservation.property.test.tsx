/**
 * Property-based preservation tests for useScreenshotDetection hook.
 *
 * Property 2: Preservation — Existing Clipboard Detection, Toasts, and Keybinds Unchanged
 *
 * These tests verify existing behavior on UNFIXED code so that after the fix
 * we can confirm no regressions were introduced. They should PASS on unfixed code.
 *
 * Tests cover:
 * - For all valid DetectionResult payloads: useScreenshotDetection sets detection state and auto-dismiss timer starts
 * - For all known reason codes in REASON_MESSAGES: mapReasonToMessage returns the documented message string
 * - For all overlay-state-update payloads with existing 9 fields: overlay renders session time, run time, run count, and area correctly
 * - For all MatchCandidate confirms with active profile and active run: createItem is called with correct parameters
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act, cleanup } from "@testing-library/react";
import { render } from "@testing-library/react";

// Setup mocks (augment the global mocks from setup.ts)
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useScreenshotDetection } from "./useScreenshotDetection";
import { useDetectionToast } from "./useDetectionToast";
import Overlay from "../overlay/Overlay";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

// ===== GENERATORS =====

/** Generate a valid MatchCandidate */
const matchCandidateArb = fc.record({
  item_name: fc.constantFrom(
    "Harlequin Crest", "Ber Rune", "Jah Rune", "Enigma", "Shako",
    "Herald of Zakarum", "Arachnid Mesh", "Stone of Jordan", "Griffon's Eye",
    "Infinity", "Torch", "Annihilus", "Mal Rune", "Ist Rune", "Vex Rune"
  ),
  category: fc.constantFrom("Unique", "Set", "Rune", "Runeword", "Rare", "Magic", "Normal", "Charm"),
  subcategory: fc.constantFrom("Weapon", "Armor", "Helmet", "Shield", "Ring", "Amulet", "Rune", "Charm", "Jewel"),
  confidence: fc.integer({ min: 50, max: 100 }),
});

/** Generate a valid DetectionResult payload */
const detectionResultArb = fc.record({
  top_match: matchCandidateArb,
  candidates: fc.array(matchCandidateArb, { minLength: 1, maxLength: 5 }),
  raw_text: fc.constantFrom("Harlequin Crest", "Ber", "Jah", "Shako", "Enigma", "SoJ"),
  is_auto_suggested: fc.boolean(),
  detected_at: fc.constantFrom(
    "2024-01-01T00:00:00Z", "2024-06-15T12:30:00Z", "2025-01-01T08:00:00Z"
  ),
});

/** Generate known reason codes */
const reasonCodeArb = fc.constantFrom(
  "no_image",
  "no_text",
  "no_match",
  "ocr_init_failed",
  "ocr_failed",
  "no_candidates"
);

/** Expected messages for each reason code (mirrors REASON_MESSAGES in useDetectionToast) */
const EXPECTED_MESSAGES: Record<string, string> = {
  no_image: "No image found in clipboard",
  no_text: "No text detected in screenshot",
  no_match: "No item detected in screenshot",
  ocr_init_failed: "Screenshot analysis failed — please try again",
  ocr_failed: "Could not read text from screenshot",
  no_candidates: "No D2R item tooltip detected in image",
};

/** Generate overlay state payloads with the existing fields */
const overlayStateArb = fc.record({
  sessionActive: fc.constant(true),
  paused: fc.boolean(),
  sessionElapsed: fc.integer({ min: 0, max: 360000 }),
  runElapsed: fc.integer({ min: 0, max: 36000 }),
  sessionRunCount: fc.integer({ min: 0, max: 999 }),
  totalRunCount: fc.integer({ min: 0, max: 9999 }),
  area: fc.constantFrom("Chaos Sanctuary", "Ancient Tunnels", "Pit", "Baal", "Mephisto", "Travincal", "Other"),
});

/** Generate a valid profile ID (UUID format) */
const profileIdArb = fc.uuid();

/** Generate a valid run ID (UUID format) */
const runIdArb = fc.uuid();

// ===== HELPERS =====

function formatTime(tenths: number): string {
  const totalSecs = Math.floor(tenths / 10);
  const frac = tenths % 10;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frac}`;
}

// ===== PROPERTY TESTS =====

describe("Property 2: Preservation — DetectionResult sets detection state and timer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property: For all valid DetectionResult payloads, when screenshot:item-detected
   * event fires, useScreenshotDetection sets detection state to the payload and
   * starts a 30-second auto-dismiss timer.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it("sets detection state for all valid DetectionResult payloads and starts auto-dismiss timer", async () => {
    await fc.assert(
      fc.asyncProperty(detectionResultArb, profileIdArb, async (detectionResult, profileId) => {
        cleanup();
        vi.clearAllMocks();

        // Capture the listener callback for screenshot:item-detected
        let detectionCallback: ((event: { payload: unknown }) => void) | null = null;

        mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
          if (eventName === "screenshot:item-detected") {
            detectionCallback = callback as (event: { payload: unknown }) => void;
          }
          return () => {};
        });

        const { result } = renderHook(() =>
          useScreenshotDetection(profileId)
        );

        // Allow useEffect setup to complete
        await act(async () => {});

        // Initially detection should be null
        expect(result.current.detection).toBeNull();

        // Fire the event with the generated DetectionResult
        act(() => {
          expect(detectionCallback).not.toBeNull();
          detectionCallback!({ payload: detectionResult });
        });

        // Detection state should now be set to the payload
        expect(result.current.detection).toEqual(detectionResult);
      }),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: For all valid DetectionResult payloads, auto-dismiss timer fires
   * after 30 seconds and clears the detection state.
   *
   * **Validates: Requirements 3.3**
   */
  it("auto-dismiss timer clears detection after 30 seconds", async () => {
    vi.useFakeTimers();

    let detectionCallback: ((event: { payload: unknown }) => void) | null = null;

    mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
      if (eventName === "screenshot:item-detected") {
        detectionCallback = callback as (event: { payload: unknown }) => void;
      }
      return () => {};
    });

    const { result } = renderHook(() =>
      useScreenshotDetection("test-profile-id")
    );

    // Allow microtasks from useEffect to resolve
    await vi.runAllTimersAsync();

    const sampleResult = {
      top_match: { item_name: "Shako", category: "Unique", subcategory: "Helmet", confidence: 92 },
      candidates: [{ item_name: "Shako", category: "Unique", subcategory: "Helmet", confidence: 92 }],
      raw_text: "Harlequin Crest",
      is_auto_suggested: true,
      detected_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      detectionCallback!({ payload: sampleResult });
    });

    expect(result.current.detection).toEqual(sampleResult);

    // Advance 29 seconds - still visible
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current.detection).toEqual(sampleResult);

    // Advance to 30 seconds - dismissed
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.detection).toBeNull();

    vi.useRealTimers();
  }, 10000);

  /**
   * Property: Detection state is cleared when dismiss() is called.
   *
   * **Validates: Requirements 3.3**
   */
  it("dismiss clears detection state for any DetectionResult", async () => {
    await fc.assert(
      fc.asyncProperty(detectionResultArb, profileIdArb, async (detectionResult, profileId) => {
        cleanup();
        vi.clearAllMocks();

        let detectionCallback: ((event: { payload: unknown }) => void) | null = null;

        mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
          if (eventName === "screenshot:item-detected") {
            detectionCallback = callback as (event: { payload: unknown }) => void;
          }
          return () => {};
        });

        const { result } = renderHook(() =>
          useScreenshotDetection(profileId)
        );

        await act(async () => {});

        // Set detection
        act(() => {
          detectionCallback!({ payload: detectionResult });
        });

        expect(result.current.detection).toEqual(detectionResult);

        // Dismiss
        act(() => {
          result.current.dismiss();
        });

        expect(result.current.detection).toBeNull();
      }),
      { numRuns: 15 }
    );
  }, 30000);
});

describe("Property 2: Preservation — mapReasonToMessage returns correct messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property: For all known reason codes in REASON_MESSAGES, the useDetectionToast
   * hook produces the documented message string when screenshot:detection-failed fires.
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  it("detection-failed event with known reason codes produces correct toast messages", async () => {
    await fc.assert(
      fc.asyncProperty(reasonCodeArb, async (reasonCode) => {
        cleanup();
        vi.clearAllMocks();

        let failedCallback: ((event: { payload: unknown }) => void) | null = null;

        mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
          if (eventName === "screenshot:detection-failed") {
            failedCallback = callback as (event: { payload: unknown }) => void;
          }
          return () => {};
        });

        const { result } = renderHook(() => useDetectionToast());

        await act(async () => {});

        // Initially no toast
        expect(result.current.toast).toBeNull();

        // Fire detection-failed with the reason code
        act(() => {
          expect(failedCallback).not.toBeNull();
          failedCallback!({ payload: { reason: reasonCode, message: "" } });
        });

        // Toast should show the correct mapped message
        expect(result.current.toast).not.toBeNull();
        expect(result.current.toast!.message).toBe(EXPECTED_MESSAGES[reasonCode]);
        expect(result.current.toast!.visible).toBe(true);
      }),
      { numRuns: 6 }
    );
  }, 30000);

  /**
   * Property: screenshot:no-profile event produces "Select a profile first to log items" toast.
   *
   * **Validates: Requirements 3.5**
   */
  it("no-profile event produces correct toast message", async () => {
    vi.clearAllMocks();

    let noProfileCallback: ((event: { payload: unknown }) => void) | null = null;

    mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
      if (eventName === "screenshot:no-profile") {
        noProfileCallback = callback as (event: { payload: unknown }) => void;
      }
      return () => {};
    });

    const { result } = renderHook(() => useDetectionToast());

    await act(async () => {});

    act(() => {
      expect(noProfileCallback).not.toBeNull();
      noProfileCallback!({ payload: undefined });
    });

    expect(result.current.toast).not.toBeNull();
    expect(result.current.toast!.message).toBe("Select a profile first to log items");
  }, 10000);
});

describe("Property 2: Preservation — Overlay renders existing state fields correctly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property: For all overlay-state-update payloads with existing fields,
   * the overlay renders session time, run time, run count, and area correctly.
   *
   * **Validates: Requirements 3.7**
   */
  it("overlay renders session time, run time, run count, and area for all valid overlay states", async () => {
    await fc.assert(
      fc.asyncProperty(overlayStateArb, async (overlayState) => {
        cleanup();
        vi.clearAllMocks();

        let stateCallback: ((event: { payload: unknown }) => void) | null = null;

        mockListen.mockImplementation(async (eventName: string, callback: unknown) => {
          if (eventName === "overlay-state-update") {
            stateCallback = callback as (event: { payload: unknown }) => void;
          }
          return () => {};
        });

        mockInvoke.mockResolvedValue(undefined);

        const { container } = render(<Overlay />);

        await act(async () => {});

        // Fire overlay-state-update with the generated state
        expect(stateCallback).not.toBeNull();

        act(() => {
          stateCallback!({ payload: overlayState });
        });

        const text = container.textContent || "";

        // Session time should be rendered
        const expectedSessionTime = formatTime(overlayState.sessionElapsed);
        expect(text).toContain(expectedSessionTime);

        // Run time should be rendered
        const expectedRunTime = formatTime(overlayState.runElapsed);
        expect(text).toContain(expectedRunTime);

        // Run count should be rendered (format: "sessionRunCount (totalRunCount)")
        expect(text).toContain(String(overlayState.sessionRunCount));
        expect(text).toContain(String(overlayState.totalRunCount));

        // Area should be rendered
        if (overlayState.area) {
          expect(text).toContain(overlayState.area);
        }
      }),
      { numRuns: 25 }
    );
  }, 30000);
});

describe("Property 2: Preservation — confirm calls createItem with correct parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property: For all MatchCandidate confirms with active profile and active run,
   * createItem is called with correct parameters (run_id, profile_id, name, item_type, rarity)
   * and updateRuneCount is called for Rune category items.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it("confirm calls createItem with correct params and updateRuneCount for Runes", async () => {
    await fc.assert(
      fc.asyncProperty(matchCandidateArb, profileIdArb, runIdArb, async (candidate, profileId, runId) => {
        cleanup();
        vi.clearAllMocks();

        mockListen.mockImplementation(async () => {
          return () => {};
        });

        // Mock: getRuns returns an active run, createItem succeeds, updateRuneCount succeeds
        mockInvoke.mockImplementation(async (cmd: string) => {
          if (cmd === "get_runs") {
            return [{
              id: runId,
              profile_id: profileId,
              area: "Chaos Sanctuary",
              duration_secs: 0,
              started_at: "2024-01-01T00:00:00Z",
              finished_at: null,
              status: "active",
              notes: null,
              player_count: null,
              route_id: null,
              route_step_index: null,
              tags: null,
            }];
          }
          if (cmd === "create_item") {
            return {
              id: "item-id",
              run_id: runId,
              profile_id: profileId,
              name: candidate.item_name,
              item_type: candidate.category,
              rarity: candidate.subcategory,
              found_at: "2024-01-01T00:00:00Z",
              notes: null,
            };
          }
          if (cmd === "update_rune_count") {
            return { profile_id: profileId, rune_name: candidate.item_name, count: 1 };
          }
          return undefined;
        });

        const { result } = renderHook(() =>
          useScreenshotDetection(profileId)
        );

        await act(async () => {});

        // Call confirm with the candidate
        await act(async () => {
          await result.current.confirm(candidate);
        });

        // Verify createItem was called with the correct parameters
        const createItemCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "create_item");
        expect(createItemCalls).toHaveLength(1);
        expect(createItemCalls[0][1]).toEqual({
          input: {
            run_id: runId,
            profile_id: profileId,
            name: candidate.item_name,
            item_type: candidate.category,
            rarity: candidate.subcategory,
          },
        });

        // If the category is "Rune", updateRuneCount should also be called
        const runeCountCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "update_rune_count");
        if (candidate.category === "Rune") {
          expect(runeCountCalls).toHaveLength(1);
          expect(runeCountCalls[0][1]).toEqual({
            profileId: profileId,
            runeName: candidate.item_name,
            delta: 1,
          });
        } else {
          expect(runeCountCalls).toHaveLength(0);
        }
      }),
      { numRuns: 25 }
    );
  }, 30000);
});
