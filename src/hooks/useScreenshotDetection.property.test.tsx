/**
 * Property-based test: Bug Condition Exploration
 *
 * Property 1: Detection Trigger Paths Fail Silently or Create Orphaned Runs
 *
 * These tests are EXPECTED TO FAIL on unfixed code. Failure confirms the five bugs exist:
 * 1. Folder source not checked on manual trigger
 * 2. Keybind registration fails silently (no user notification)
 * 3. Overlay detection not relayed (no listener for events)
 * 4. No session guard (detection proceeds without active session)
 * 5. Overlay item count missing from overlay-state-update payload
 *
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act, cleanup } from "@testing-library/react";
import { render, screen } from "@testing-library/react";

// Mock modules before importing the modules that use them
vi.mock("@tauri-apps/api/core");
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn().mockReturnValue(Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    startDragging: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));
vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn(),
  unregister: vi.fn().mockResolvedValue(undefined),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
  isRegistered: vi.fn().mockResolvedValue(false),
}));

import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { register } from "@tauri-apps/plugin-global-shortcut";
import { useScreenshotDetection } from "./useScreenshotDetection";
import { registerHotkeys } from "../pages/Settings";
import Overlay from "../overlay/Overlay";

const mockInvoke = vi.mocked(invoke);
const mockEmit = vi.mocked(emit);
const mockListen = vi.mocked(listen);
const mockRegister = vi.mocked(register);

// ===== GENERATORS =====

/** Generate a valid profile ID */
const profileIdArb = fc.uuid();

/** Generate a folder path */
const folderPathArb = fc.constantFrom(
  "/home/user/D2R/Screenshots",
  "C:\\Users\\Player\\Documents\\Diablo II Resurrected\\Screenshots",
  "/tmp/screenshots"
);

/** Generate a keybind string that would cause registration to fail */
const failingKeybindArb = fc.constantFrom(
  "Ctrl+Shift+D",
  "Alt+F4",
  "Ctrl+Alt+Delete",
  "F12"
);

// ===== PROPERTY TESTS =====

describe("Bug Condition: Detection Trigger Paths Fail Silently or Create Orphaned Runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: listen returns unsubscribe function
    mockListen.mockReturnValue(Promise.resolve(() => {}));
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Bug 1: Folder source not checked on manual trigger
   *
   * When triggerManual() is called with folder monitoring enabled and new files
   * exist in the configured folder, the system should process those files.
   *
   * On UNFIXED code, triggerManual() only calls detectFromClipboard and never
   * checks the folder source. This test FAILS because no folder detection occurs.
   *
   * **Validates: Requirements 1.1**
   */
  it("triggerManual processes folder files when folder monitoring is enabled", async () => {
    await fc.assert(
      fc.asyncProperty(profileIdArb, async (profileId) => {
        cleanup();
        vi.clearAllMocks();
        mockListen.mockReturnValue(Promise.resolve(() => {}));

        // Mock: clipboard detection succeeds
        mockInvoke.mockImplementation(async (cmd) => {
          if (cmd === "detect_from_clipboard") return undefined;
          if (cmd === "detect_latest_folder_file") return true;
          return undefined;
        });

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection(profileId, onError, true)
        );

        // Trigger manual detection
        await act(async () => {
          result.current.triggerManual();
          // Allow promises to resolve
          await new Promise((r) => setTimeout(r, 50));
        });

        // Bug 1 assertion: detect_latest_folder_file should be called.
        // On unfixed code, ONLY detect_from_clipboard is called.
        const folderCalls = mockInvoke.mock.calls.filter(
          ([cmd]) => cmd === "detect_latest_folder_file"
        );
        expect(folderCalls.length).toBeGreaterThan(0);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Bug 2: Keybind registration fails silently
   *
   * When registerHotkeys() is called and the detectScreenshot keybind causes
   * register() to throw, the system should emit a screenshot:keybind-failed event
   * or show a toast notification. On unfixed code, it only console.warn()s.
   *
   * **Validates: Requirements 1.4, 1.5**
   */
  it("registerHotkeys emits keybind-failed event when registration throws", async () => {
    await fc.assert(
      fc.asyncProperty(failingKeybindArb, async (keybind) => {
        vi.clearAllMocks();

        // Set up localStorage with the failing keybind
        const hotkeyConfig = {
          nextRun: "F9",
          pause: "F10",
          endSession: "F11",
          detectScreenshot: keybind,
        };
        localStorage.setItem("d2r_hotkeys", JSON.stringify(hotkeyConfig));

        // Mock: register succeeds for F9, F10, F11 but throws for the detectScreenshot keybind
        mockRegister.mockImplementation(async (shortcut) => {
          if (shortcut === keybind) {
            throw new Error(`Shortcut ${keybind} is already registered by another application`);
          }
          // Other keybinds succeed
          return undefined;
        });

        // Call registerHotkeys
        await registerHotkeys();

        // Bug 2 assertion: a keybind-failed event should be emitted
        // On unfixed code, only console.warn is called — no event is emitted
        const keybindFailedCalls = mockEmit.mock.calls.filter(
          ([eventName]) => eventName === "screenshot:keybind-failed"
        );
        expect(keybindFailedCalls.length).toBeGreaterThan(0);
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Bug 3: Overlay detection not relayed
   *
   * When the overlay's handleDetect fires and screenshot:item-detected event
   * arrives, the overlay should show a status indicator or emit a relay event
   * to the main window. On unfixed code, overlay has no listener for these events.
   *
   * **Validates: Requirements 1.6, 1.7**
   */
  it("overlay listens for screenshot:item-detected events", async () => {
    vi.clearAllMocks();

    // Track what events the overlay listens for
    const listenedEvents: string[] = [];
    mockListen.mockImplementation(async (eventName) => {
      listenedEvents.push(eventName as string);
      return () => {};
    });

    // Mock invoke for overlay state
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "detect_from_clipboard") return undefined;
      return undefined;
    });

    render(<Overlay />);

    // Wait for effects to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Bug 3 assertion: overlay should have registered a listener for
    // screenshot:item-detected or screenshot:detection-failed
    // On unfixed code, the overlay only listens for "overlay-state-update"
    const hasDetectionListener = listenedEvents.some(
      (e) => e === "screenshot:item-detected" || e === "screenshot:detection-failed"
    );
    expect(hasDetectionListener).toBe(true);
  });

  /**
   * Bug 4: No session guard
   *
   * When triggerManual() is called with no active session (no active run) and
   * a valid profile, detection should be blocked with a toast message
   * "Start a session first to detect items". On unfixed code, getOrCreateRunId
   * creates an orphaned run unconditionally.
   *
   * **Validates: Requirements 1.8, 1.9**
   */
  it("triggerManual blocks detection when no active session exists", async () => {
    await fc.assert(
      fc.asyncProperty(profileIdArb, async (profileId) => {
        cleanup();
        vi.clearAllMocks();
        mockListen.mockReturnValue(Promise.resolve(() => {}));

        // Mock: no active runs (empty array — no session active)
        mockInvoke.mockImplementation(async (cmd) => {
          if (cmd === "detect_from_clipboard") return undefined;
          if (cmd === "get_runs") return []; // No active runs
          if (cmd === "create_run") {
            // If this is called, it means the bug exists — run is being created
            return { id: "orphaned-run-id", profile_id: profileId, area: "Screenshot Detection", duration_secs: 0, started_at: new Date().toISOString(), finished_at: null, status: "active", notes: null, player_count: null, route_id: null, route_step_index: null, tags: null };
          }
          return undefined;
        });

        const onError = vi.fn();
        const { result } = renderHook(() =>
          useScreenshotDetection(profileId, onError)
        );

        // Trigger manual detection with no active session
        await act(async () => {
          result.current.triggerManual();
          await new Promise((r) => setTimeout(r, 50));
        });

        // Bug 4 assertion: detection should be BLOCKED and onError called with
        // "Start a session first to detect items"
        // On unfixed code, detect_from_clipboard is called without any session check
        expect(onError).toHaveBeenCalledWith("Start a session first to detect items");

        // Additionally verify detect_from_clipboard was NOT called
        const clipboardCalls = mockInvoke.mock.calls.filter(
          ([cmd]) => cmd === "detect_from_clipboard"
        );
        expect(clipboardCalls.length).toBe(0);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Bug 5: Overlay item count missing from overlay-state-update payload
   *
   * The overlay-state-update event payload should include a runItemCount field
   * when a session is active and items are logged. On unfixed code, this field
   * doesn't exist in the emitted payload.
   *
   * This test inspects the OverlayState interface and the emitted payload structure.
   * We verify by checking what the Overlay component expects to receive and render.
   *
   * **Validates: Requirements 1.9**
   */
  it("overlay-state-update payload includes runItemCount field", async () => {
    vi.clearAllMocks();

    // Capture the callback passed to listen for "overlay-state-update"
    let overlayStateCallback: ((event: { payload: Record<string, unknown> }) => void) | null = null;

    mockListen.mockImplementation(async (eventName, callback) => {
      if (eventName === "overlay-state-update") {
        overlayStateCallback = callback as (event: { payload: Record<string, unknown> }) => void;
      }
      return () => {};
    });

    mockInvoke.mockResolvedValue(undefined);

    const { container } = render(<Overlay />);

    // Wait for listeners to register
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Simulate an overlay-state-update event WITH sessionActive and items
    // This is the payload that RunTracker currently emits
    const currentPayload = {
      sessionActive: true,
      paused: false,
      sessionElapsed: 1200,
      runElapsed: 300,
      sessionRunCount: 5,
      totalRunCount: 42,
      area: "Chaos Sanctuary",
      profileName: "TestProfile",
      fastestTime: 180,
      // NOTE: runItemCount is NOT in the current payload — this is the bug
    };

    expect(overlayStateCallback).not.toBeNull();

    // Fire the state update
    await act(async () => {
      overlayStateCallback!({ payload: currentPayload });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Bug 5 assertion: the overlay should display item count information
    // On unfixed code, runItemCount is not in the payload and not displayed
    // We check that the rendered overlay shows item count info
    const overlayText = container.textContent || "";
    const hasItemCount = overlayText.includes("Items:") || overlayText.includes("items");
    expect(hasItemCount).toBe(true);
  });
});
