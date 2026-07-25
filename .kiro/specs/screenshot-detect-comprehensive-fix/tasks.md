# Implementation Plan: Screenshot Detection Comprehensive Bugfix

## Overview

This plan fixes five interconnected bugs in the screenshot detection system using the exploratory bugfix workflow: (1) folder source not integrated with manual trigger and not auto-started on launch, (2) keybind registration fails silently, (3) overlay button doesn't relay detection results, (4) detection proceeds without active session, (5) overlay doesn't show run item count. The approach follows: write exploration tests first to confirm bugs exist, write preservation tests to capture baseline behavior, then implement fixes and verify both test suites pass.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Detection Trigger Paths Fail Silently or Create Orphaned Runs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the five bugs exist in the current code
  - **Scoped PBT Approach**: For these deterministic bugs, scope properties to concrete failing cases
  - Test file: `src/hooks/useScreenshotDetection.property.test.tsx`
  - **Bug 1 - Folder source not checked on manual trigger**:
    - Call `triggerManual()` with folder monitoring enabled and new files in folder
    - Assert that folder files are processed (will FAIL — current code only calls `detectFromClipboard`)
  - **Bug 2 - Keybind silent failure**:
    - Call `registerHotkeys()` with a keybind that causes `register()` to throw
    - Assert a `screenshot:keybind-failed` event is emitted or toast is shown (will FAIL — current code only `console.warn`s)
  - **Bug 3 - Overlay detection not relayed**:
    - Simulate overlay `handleDetect` click followed by `screenshot:item-detected` event
    - Assert overlay shows a status indicator or emits relay event to main window (will FAIL — overlay has no listener)
  - **Bug 4 - No session guard**:
    - Call `triggerManual()` with no active session and a valid profile
    - Assert detection is blocked and toast shows "Start a session first to detect items" (will FAIL — current code proceeds and `getOrCreateRunId` creates orphaned run)
  - **Bug 5 - Overlay item count missing**:
    - Inspect `overlay-state-update` event payload with active session and items logged
    - Assert payload includes `runItemCount` field (will FAIL — field doesn't exist in current payload)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples: `triggerManual` only checks clipboard, `registerHotkeys` catch block logs to console only, overlay `handleDetect` has empty catch with no listeners, `getOrCreateRunId` creates run unconditionally, `overlay-state-update` payload lacks `runItemCount`
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Clipboard Detection, Toasts, and Keybinds Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/hooks/useScreenshotDetection.preservation.property.test.tsx`
  - **Observe on UNFIXED code:**
    - Clipboard detection with active session: `triggerManual()` calls `detectFromClipboard()` → backend emits `screenshot:item-detected` → `useScreenshotDetection` hook picks up event → `detection` state is set → ConfirmationDialog shown
    - Detection failure: backend emits `screenshot:detection-failed` with reason → `useDetectionToast` maps reason to message via `REASON_MESSAGES` → toast shown
    - No profile guard: `screenshot:no-profile` event → toast shows "Select a profile first to log items"
    - Working keybinds (F9, F10, F11): `registerHotkeys` registers all non-detect keybinds successfully
    - Overlay state update includes existing fields: `sessionActive`, `paused`, `sessionElapsed`, `runElapsed`, `sessionRunCount`, `totalRunCount`, `area`, `profileName`, `fastestTime`
    - `mapReasonToMessage` returns correct messages for all known reason codes
  - **Write property-based tests:**
    - For all valid `DetectionResult` payloads: assert `useScreenshotDetection` sets detection state and auto-dismiss timer starts
    - For all known reason codes in REASON_MESSAGES: assert `mapReasonToMessage` returns the documented message string
    - For all overlay-state-update payloads with the existing 9 fields: assert overlay renders session time, run time, run count, and area correctly
    - For all `MatchCandidate` confirms with active profile and active run: assert `createItem` is called with correct parameters and rune count updated for Rune category
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix all five detection system bugs

  - [x] 3.1 Add session guard to `useScreenshotDetection` hook
    - In `triggerManual()`: accept `sessionActive` boolean parameter (or derive from runs state)
    - Before calling `detectFromClipboard()`, check if session is active
    - If no active session: call `onError("Start a session first to detect items")` and return early without invoking backend
    - Change `getOrCreateRunId` to return `null` when no active run exists (remove auto-creation of "Screenshot Detection" run)
    - In `confirm()`: if `getOrCreateRunId` returns null, call `onError("Start a session first to detect items")` and return without creating item
    - Pass `sessionActive` from `App.tsx` to the hook (from RunTracker's session state)
    - _Bug_Condition: input.hasActiveSession = FALSE AND input.detectionTriggered = TRUE_
    - _Expected_Behavior: detection_blocked(result) = TRUE AND toast_displayed("Start a session first to detect items")_
    - _Preservation: When session IS active, detection proceeds identically to before_
    - _Requirements: 2.8, 2.9, 3.1, 3.2, 3.3_

  - [x] 3.2 Add keybind registration failure feedback
    - In `registerHotkeys()` in `Settings.tsx`: in the `catch` block for `detectScreenshot` registration, emit a Tauri event `screenshot:keybind-failed` with payload `{ key: config.detectScreenshot, reason: String(err) }`
    - In `useDetectionToast.ts`: add a listener for `screenshot:keybind-failed` that calls `showToast` with message like `"Keybind ${key} could not be registered — ${reason}"`
    - Ensure other keybinds (nextRun, pause, endSession) continue to register independently even if detectScreenshot fails
    - _Bug_Condition: input.shortcutRegistrationFailed = TRUE AND input.userNotified = FALSE_
    - _Expected_Behavior: toast_displayed(result, keybind failure message with key combo and reason)_
    - _Preservation: F9, F10, F11 keybinds registration unchanged_
    - _Requirements: 2.4, 2.5, 3.6_

  - [x] 3.3 Fix overlay detection result relay
    - In `Overlay.tsx`: add `useEffect` listeners for `screenshot:item-detected` and `screenshot:detection-failed` events
    - On `screenshot:item-detected`: show a brief "✓ Item detected" status indicator in overlay (auto-dismiss after 3s), and emit `screenshot:overlay-detected` event so main window can bring itself to focus
    - On `screenshot:detection-failed`: show a brief "✗ Detection failed" indicator in overlay (auto-dismiss after 3s)
    - In the main window (App.tsx or useScreenshotDetection): add listener for `screenshot:overlay-detected` to call `getCurrentWindow().setFocus()` so the ConfirmationDialog is visible to the user
    - Guard overlay detect button: when `state.sessionActive` is false, call a local toast "Start a session first" instead of invoking `detect_from_clipboard`
    - _Bug_Condition: input.triggerSource = "overlay_button" AND input.mainWindowNotified = FALSE_
    - _Expected_Behavior: overlay shows status indicator AND main_window_notified(result) = TRUE_
    - _Preservation: Main window's useScreenshotDetection hook continues to receive events identically_
    - _Requirements: 2.6, 2.7, 2.8, 3.3, 3.4_

  - [x] 3.4 Integrate folder source with manual detection trigger
    - In `src/hooks/useScreenshotDetection.ts` `triggerManual()`: after calling `detectFromClipboard()`, if folder monitoring is enabled in settings, also call a new API function `detectFromFolder()` that invokes a new Tauri command
    - In `src-tauri/src/screenshot/mod.rs`: add a `detect_from_folder` command that calls `FolderWatcher::poll_new_files()` on the managed state and processes any new files through the detection pipeline (reusing `process_image` logic)
    - In `src-tauri/src/lib.rs` `setup` closure: read persisted screenshot settings from the database on startup; if `folder_monitoring_enabled` is `true` and a valid folder path exists, record the current baseline (file count + latest mtime) and start the `FolderWatcher`, storing it in `FolderWatcherState`
    - Add `detect_from_folder` to the Tauri command handlers in `lib.rs`
    - Expose `detectFromFolder` in the frontend `api.ts`
    - _Bug_Condition: (input.triggerSource IN ["sidebar_button", "keybind"]) AND input.folderMonitoringEnabled AND input.newFilesInFolder AND input.folderFilesProcessed = FALSE_
    - _Expected_Behavior: folder_files_processed(result) = TRUE AND folder_watcher_started on app launch_
    - _Preservation: Clipboard detection path unchanged — folder check is additive_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.5 Add overlay item count display
    - In `src/pages/RunTracker.tsx`: add `runItemCount` to the `overlay-state-update` emit payload, sourced from the current run's items array length
    - In `src/overlay/Overlay.tsx`: add `runItemCount` to the `OverlayState` interface (default `0`)
    - Render item count in the overlay stats section: display "Items: {state.runItemCount}" alongside run count
    - Ensure the count updates on each `overlay-state-update` tick (RunTracker already re-emits when items change)
    - _Bug_Condition: input.sessionActive AND input.overlayVisible AND input.itemCountDisplayed = FALSE_
    - _Expected_Behavior: overlay_item_count_displayed(result) = TRUE with correct count_
    - _Preservation: All existing overlay-state-update fields unchanged, just adding new field_
    - _Requirements: 2.9, 2.10, 3.7_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - All Detection Trigger Paths Produce Visible Results
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for all five bug conditions
    - When this test passes, it confirms:
      - Folder source is checked on manual trigger
      - Keybind failure produces user-visible toast
      - Overlay detection relays results to main window
      - No-session detection is blocked with toast
      - Overlay shows item count
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Clipboard Detection, Toasts, and Keybinds Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm clipboard detection, toast messages, overlay state updates, and confirm flow all unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npm test` to verify all frontend tests pass (Vitest)
  - Run `cd src-tauri && cargo check` to verify zero Rust warnings
  - Run `cd src-tauri && cargo test` to verify all Rust tests pass
  - Run `npx tsc --noEmit` to verify no TypeScript errors
  - Ensure exploration test (Property 1) passes after fix
  - Ensure preservation tests (Property 2) pass after fix
  - Ensure existing tests (`ScreenshotSettings.test.tsx`, `DetectionToast.test.tsx`, `Overlay.test.tsx`) all still pass
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```

## Notes

- Task 1 (exploration test) and Task 2 (preservation test) MUST run on unfixed code — they validate the bugs exist and capture baseline behavior
- Task 3.1 (session guard) and 3.2 (keybind feedback) are independent and can be done in parallel
- Task 3.3 (overlay relay) depends on 3.1 because it needs the session guard for overlay detect button
- Task 3.4 (folder source) is independent of 3.1-3.3 and can be done in parallel with 3.3
- Task 3.5 (overlay item count) is independent of the others and can be done in parallel with 3.3/3.4
- Tasks 3.6 and 3.7 are verification steps that re-run existing tests — no new test code written
- All TypeScript code must pass `tsc --noEmit` and all Rust code must compile with zero warnings
- Use regular comments (`//`) above `proptest!` blocks in Rust, not doc comments (`///`)
- The overlay `handleDetect` session guard shares logic with the main window guard — both show "Start a session first" message
- The `overlay-state-update` payload extension (adding `runItemCount`) is backward-compatible since the overlay interface is updated in the same change
- The `getOrCreateRunId` change from auto-creating runs to returning null is a breaking behavioral change that aligns with requirement 2.8 — tests must be updated accordingly
