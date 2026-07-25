/**
 * Property tests for useScreenshotDetection triggerManual behavior.
 *
 * Tests that triggerManual:
 * - calls detectFromClipboard when session is active
 * - calls detectLatestFolderFile when session is active
 * - blocks detection with onError when no session is active
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act } from "@testing-library/react";

vi.mock("../api", () => ({
  detectFromClipboard: vi.fn().mockResolvedValue(undefined),
  detectLatestFolderFile: vi.fn().mockResolvedValue(false),
  createItem: vi.fn(),
  createRun: vi.fn(),
  getRuns: vi.fn().mockResolvedValue([{ id: "run-1", profile_id: "test-profile", finished_at: null }]),
  updateRuneCount: vi.fn(),
}));

import { detectFromClipboard, detectLatestFolderFile } from "../api";
import { useScreenshotDetection } from "./useScreenshotDetection";

const mockedDetectFromClipboard = vi.mocked(detectFromClipboard);
const mockedDetectLatestFolderFile = vi.mocked(detectLatestFolderFile);

describe("Feature: screenshot-detect, triggerManual behavior", () => {
  beforeEach(() => {
    mockedDetectFromClipboard.mockReset();
    mockedDetectLatestFolderFile.mockReset();
    mockedDetectFromClipboard.mockResolvedValue(undefined);
    mockedDetectLatestFolderFile.mockResolvedValue(false);
  });

  /**
   * Property 1a: triggerManual calls both detectFromClipboard and
   * detectLatestFolderFile when session is active.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("triggerManual calls detectFromClipboard and detectLatestFolderFile when session is active", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (profileId) => {
        mockedDetectFromClipboard.mockResolvedValue(undefined);
        mockedDetectLatestFolderFile.mockResolvedValue(false);

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection(profileId, onError, true)
        );

        await act(async () => {
          result.current.triggerManual();
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(mockedDetectFromClipboard).toHaveBeenCalled();
        expect(mockedDetectLatestFolderFile).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 1b: triggerManual blocks and calls onError when no session is active.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("triggerManual calls onError when sessionActive is false", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (profileId) => {
        mockedDetectFromClipboard.mockClear();
        mockedDetectLatestFolderFile.mockClear();

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection(profileId, onError, false)
        );

        await act(async () => {
          result.current.triggerManual();
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(onError).toHaveBeenCalledWith("Start a session first to detect items");
        expect(mockedDetectFromClipboard).not.toHaveBeenCalled();
      }),
      { numRuns: 10 }
    );
  });
});
