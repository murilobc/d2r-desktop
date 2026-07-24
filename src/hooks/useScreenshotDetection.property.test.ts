/**
 * Bug Condition Exploration Property Test
 *
 * Tests that `triggerManual` invokes `onError` when `detectFromClipboard`
 * rejects with a "no_image" error — and invokes it with a generic message
 * for other errors.
 *
 * EXPECTED: This test FAILS on unfixed code because `useScreenshotDetection`
 * does not accept or invoke an `onError` callback. Failure confirms the bug.
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act } from "@testing-library/react";

vi.mock("../api", () => ({
  detectFromClipboard: vi.fn(),
  createItem: vi.fn(),
  createRun: vi.fn(),
  getRuns: vi.fn(),
  updateRuneCount: vi.fn(),
}));

import { detectFromClipboard } from "../api";
import { useScreenshotDetection } from "./useScreenshotDetection";

const mockedDetectFromClipboard = vi.mocked(detectFromClipboard);

// ===== GENERATORS =====

/** Generate error messages that contain "no_image" — the bug condition. */
const noImageErrorArb = fc.constantFrom(
  "no_image",
  "error: no_image found",
  "clipboard no_image",
  "no_image: clipboard is empty",
  "detect_from_clipboard failed: no_image"
);

/** Generate generic error messages that do NOT contain "no_image". */
const genericErrorArb = fc.constantFrom(
  "network timeout",
  "unknown backend error",
  "permission denied",
  "clipboard access failed",
  "internal error: decode failed"
);

// ===== PROPERTY TESTS =====

describe("Feature: screenshot-detect-no-feedback-fix, Property 1: Bug Condition - No-Image Error Silent Failure", () => {
  beforeEach(() => {
    mockedDetectFromClipboard.mockReset();
  });

  /**
   * Property 1a: For any error containing "no_image", triggerManual
   * should invoke onError with "No image found in clipboard".
   *
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
   */
  it("triggerManual calls onError with 'No image found in clipboard' when detectFromClipboard rejects with a no_image error", async () => {
    await fc.assert(
      fc.asyncProperty(noImageErrorArb, async (errorMsg) => {
        mockedDetectFromClipboard.mockRejectedValueOnce(errorMsg);

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection("test-profile", onError)
        );

        await act(async () => {
          result.current.triggerManual();
          // Allow microtask queue to flush (promise rejection handling)
          await new Promise((r) => setTimeout(r, 0));
        });

        expect(onError).toHaveBeenCalledWith("No image found in clipboard");
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1b: For any generic error (not containing "no_image"),
   * triggerManual should invoke onError with "Screenshot detection failed".
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("triggerManual calls onError with 'Screenshot detection failed' for generic errors", async () => {
    await fc.assert(
      fc.asyncProperty(genericErrorArb, async (errorMsg) => {
        mockedDetectFromClipboard.mockRejectedValueOnce(errorMsg);

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection("test-profile", onError)
        );

        await act(async () => {
          result.current.triggerManual();
          // Allow microtask queue to flush
          await new Promise((r) => setTimeout(r, 0));
        });

        expect(onError).toHaveBeenCalledWith("Screenshot detection failed");
      }),
      { numRuns: 20 }
    );
  });
});
