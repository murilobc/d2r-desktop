# Screenshot Detection Comprehensive Bugfix Design

## Overview

The screenshot detection system has five interconnected bugs that prevent it from functioning correctly across trigger paths:

1. **Folder source not integrated with manual trigger and not auto-started on launch** — the sidebar "Detect Screenshot" button only checks clipboard, ignoring new files in the configured screenshots folder; the folder watcher is not started when the app launches with `folder_monitoring_enabled: true`.
2. **Keybind registration fails silently** — when `register()` throws (e.g., key combo in use), the error is caught and logged to console with no user-visible feedback.
3. **Overlay button doesn't relay detection results** — the overlay invokes `detect_from_clipboard` but has no listeners for `screenshot:item-detected` or `screenshot:detection-failed`, so the user sees nothing.
4. **Detection proceeds without active session** — `getOrCreateRunId` creates a standalone "Screenshot Detection" run when no session is active, creating orphaned items without user intent.
5. **Overlay doesn't show run item count** — the `overlay-state-update` event payload lacks item count data, so the overlay cannot display how many items have been logged in the current run.

The fix approach is minimal and targeted: each bug is addressed at the specific layer where the defect exists (frontend hooks, overlay component, event payloads) without altering the core detection pipeline (OCR, color detection, matching).

## Glossary

- **Bug_Condition (C)**: The set of conditions under which one or more of the five bugs manifests — detection is triggered but results are invisible, lost, or incorrectly routed
- **Property (P)**: The desired behavior — all trigger paths produce visible, correct results when a session is active, and are blocked with feedback when no session exists
- **Preservation**: Existing clipboard detection, auto-detection, confidence dialog, toast notifications, and other keybinds must remain unchanged
- **`detect_from_clipboard`**: Tauri command in `src-tauri/src/screenshot/mod.rs` that performs one-shot clipboard detection
- **`detect_from_file`**: Tauri command that reads an image file from disk and runs the detection pipeline
- **`FolderWatcher`**: Struct in `src-tauri/src/screenshot/folder_watcher.rs` that polls for new `.jpg`/`.png` files
- **`useScreenshotDetection`**: Hook in `src/hooks/useScreenshotDetection.ts` that listens for `screenshot:item-detected` events and provides confirm/dismiss/triggerManual
- **`useDetectionToast`**: Hook in `src/hooks/useDetectionToast.ts` that listens for `screenshot:detection-failed` and `screenshot:no-profile` events
- **`registerHotkeys`**: Function in `src/pages/Settings.tsx` that registers global shortcuts via `@tauri-apps/plugin-global-shortcut`
- **`overlay-state-update`**: Tauri event emitted by RunTracker every tick with session state for the overlay window

## Bug Details

### Bug Condition

The bug manifests across five distinct trigger paths. The detection system either fails to run, runs but produces no visible output, or runs without proper session validation.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type DetectionTriggerInput
  OUTPUT: boolean

  // Bug 1: Folder source not checked on manual trigger + not auto-started
  folderBug ← (input.triggerSource IN ["sidebar_button", "keybind"])
              AND input.folderMonitoringEnabled = TRUE
              AND input.newFilesInFolder = TRUE
              AND input.folderFilesProcessed = FALSE

  startupBug ← input.triggerSource = "app_startup"
               AND input.folderMonitoringEnabled = TRUE
               AND input.folderWatcherRunning = FALSE

  // Bug 2: Keybind fails silently
  keybindBug ← input.keybindConfigured = TRUE
               AND input.shortcutRegistrationFailed = TRUE
               AND input.userNotified = FALSE

  // Bug 3: Overlay results not visible
  overlayBug ← input.triggerSource = "overlay_button"
               AND input.detectionCompleted = TRUE
               AND input.mainWindowNotified = FALSE

  // Bug 4: Detection without active session
  sessionBug ← input.hasActiveSession = FALSE
               AND input.hasProfile = TRUE
               AND input.detectionTriggered = TRUE
               AND input.detectionBlocked = FALSE

  // Bug 5: Overlay item count not shown
  itemCountBug ← input.sessionActive = TRUE
                 AND input.overlayVisible = TRUE
                 AND input.itemCountDisplayed = FALSE

  RETURN folderBug OR startupBug OR keybindBug OR overlayBug OR sessionBug OR itemCountBug
END FUNCTION
```

### Examples

- **Bug 1**: User presses Print Screen, a `Screenshot001.jpg` appears in `Documents/Diablo II Resurrected/Screenshots/`, user clicks "Detect Screenshot" sidebar button → only clipboard is checked, the new file is ignored
- **Bug 1 (startup)**: User has `folder_monitoring_enabled: true` in settings, restarts the app → folder watcher is never started, new screenshots in the folder are ignored until user manually toggles the setting off/on
- **Bug 2**: User sets `Ctrl+Shift+D` as detectScreenshot keybind, but Discord already claims that combo → `register()` throws, error is caught with `console.warn`, user sees no indication the keybind is inactive
- **Bug 3**: User clicks ◫ in overlay, detection succeeds (OCR + match) → `screenshot:item-detected` event fires but overlay has no listener, main window's `useScreenshotDetection` picks it up (since it's a global event) but the ConfirmationDialog is behind the overlay with no visual cue
- **Bug 4**: User has no active session, clicks "Detect Screenshot" → `getOrCreateRunId` creates a "Screenshot Detection" run, item gets logged to an orphaned run the user didn't intend
- **Bug 5**: User has active session with 3 items logged → overlay shows run time, run count, area, but no item count

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Clipboard-based detection via Flameshot continues to work identically (same pipeline, same events)
- Clipboard monitoring auto-detection (polling every 1 second) continues unchanged
- `screenshot:item-detected` event payload structure remains unchanged
- `screenshot:detection-failed` event payload structure remains unchanged
- ConfirmationDialog rendering, dismiss/confirm/change flow unchanged
- DetectionToast rendering and auto-dismiss unchanged
- `nextRun`, `pause`, `endSession` keybinds registration unchanged
- Overlay session timer, run timer, run count, area display unchanged
- Mouse/keyboard interactions on overlay controls (split, pause, stop, +) unchanged
- `detect_from_file` Tauri command behavior unchanged

**Scope:**
All inputs that do NOT involve the five bug conditions should be completely unaffected. This includes:
- Clipboard detection with active session (existing working path)
- Profile selection and "no profile" toast
- Manual item search via ItemSearch component
- All non-detection keybinds (F9, F10, F11)
- Overlay drag, close, theme application

## Hypothesized Root Cause

Based on code analysis:

1. **Folder source not checked on manual trigger**: `detect_from_clipboard` (the Tauri command invoked by the sidebar button and keybind) only reads the clipboard via `ClipboardMonitor::detect_once()`. It never calls `FolderWatcher::poll_new_files()`. The frontend `triggerManual` function in `useScreenshotDetection` only calls `detectFromClipboard()` from the API. **Root cause**: Missing integration — manual trigger should also check folder source when folder monitoring is enabled.

2. **Folder watcher not auto-started on launch**: In `lib.rs`, the `setup` closure initializes `FolderWatcherState` as `None`. No code reads persisted settings and conditionally starts the watcher. The watcher only starts when `update_screenshot_settings` is called with `folder_monitoring_enabled: true` (i.e., when the user toggles the setting in the UI).

3. **Keybind registration silent failure**: In `registerHotkeys()` (Settings.tsx line 66), the `detectScreenshot` registration is wrapped in `try/catch` that only calls `console.warn`. No toast, no event, no state update visible to the user.

4. **Overlay results not relayed**: In `Overlay.tsx`, `handleDetect` calls `invoke("detect_from_clipboard")` and catches errors silently. The overlay has no `listen("screenshot:item-detected", ...)` or `listen("screenshot:detection-failed", ...)`. Since both windows share the same Tauri app handle, the events DO reach both windows, but the overlay doesn't display anything. The main window's `useScreenshotDetection` hook DOES receive the event, but the ConfirmationDialog appears in the main window which may be hidden behind the game. **Root cause**: Overlay should emit a focused event to bring the main window to attention, or the overlay should show a brief confirmation indicator.

5. **Detection without session**: `getOrCreateRunId` in `useScreenshotDetection.ts` creates a run when none exists. There is no guard checking whether a session is active before proceeding with the confirm flow. The `triggerManual` function also doesn't check session state before invoking the backend.

6. **Overlay item count missing**: The `overlay-state-update` event payload (emitted in `RunTracker.tsx`) includes `sessionActive`, `paused`, `sessionElapsed`, `runElapsed`, `sessionRunCount`, `totalRunCount`, `area`, `profileName`, `fastestTime` — but no `runItemCount` field.

## Correctness Properties

Property 1: Bug Condition - Folder Source Checked on Manual Trigger

_For any_ manual detection trigger (sidebar button or keybind) where `folder_monitoring_enabled` is `true` and new screenshot files exist in the configured folder, the fixed system SHALL process those files through the detection pipeline in addition to checking the clipboard.

**Validates: Requirements 2.2, 2.3**

Property 2: Bug Condition - Folder Watcher Auto-Start on Launch

_For any_ application startup where `folder_monitoring_enabled` is `true` in persisted settings, the fixed system SHALL record the current folder baseline and start the folder watcher automatically without requiring user interaction.

**Validates: Requirements 2.1**

Property 3: Bug Condition - Keybind Registration Failure Feedback

_For any_ keybind registration attempt that throws an error, the fixed system SHALL display a user-visible toast notification containing the failed key combination and a reason message.

**Validates: Requirements 2.5**

Property 4: Bug Condition - Overlay Detection Relay

_For any_ detection triggered via the overlay button that completes (success or failure), the fixed system SHALL ensure the result is visible to the user — either by emitting an event that the main window acts on with focus, or by showing a brief status indicator in the overlay itself.

**Validates: Requirements 2.6, 2.7**

Property 5: Bug Condition - No-Session Detection Blocked

_For any_ detection trigger (sidebar, keybind, overlay, folder watcher) where no active session/run exists, the fixed system SHALL block the detection pipeline and display a toast with "Start a session first to detect items".

**Validates: Requirements 2.8, 2.9**

Property 6: Bug Condition - Overlay Item Count Display

_For any_ active session where items have been logged to the current run, the overlay SHALL display the current run's item count, updated in real-time via the `overlay-state-update` event.

**Validates: Requirements 2.10**

Property 7: Preservation - Existing Detection Pipeline Unchanged

_For any_ input where none of the five bug conditions hold (clipboard detection with active session, working keybinds, non-overlay triggers), the fixed system SHALL produce exactly the same behavior as the original system, preserving clipboard monitoring, event emission, confidence dialog, and toast notifications.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

#### Bug 1 Fix: Folder Source Integration with Manual Trigger + Auto-Start

**File**: `src-tauri/src/screenshot/mod.rs`

**Function**: `detect_from_clipboard` (and new startup logic)

**Specific Changes**:
1. **Add folder check to `detect_from_clipboard`**: After clipboard detection, if `folder_monitoring_enabled` is true, call `FolderWatcher::poll_new_files()` on the managed `FolderWatcherState` and process any new files via `ClipboardMonitor::process_image()`.
2. **Create a new command or setup hook**: Add logic in the `setup` closure in `lib.rs` to read persisted settings on startup. If `folder_monitoring_enabled` is `true`, resolve the folder path and start the `FolderWatcher`, storing it in `FolderWatcherState`.

**File**: `src-tauri/src/lib.rs`

**Function**: `run()` → `setup` closure

**Specific Changes**:
3. **Auto-start folder watcher on launch**: After initializing `DbState`, read screenshot settings from the database. If `folder_monitoring_enabled` is true and a valid folder path exists, start the `FolderWatcher` and store it in the managed state.

#### Bug 2 Fix: Keybind Registration Failure Feedback

**File**: `src/pages/Settings.tsx`

**Function**: `registerHotkeys()`

**Specific Changes**:
4. **Emit error event on registration failure**: In the `catch` block for `detectScreenshot` registration, emit a Tauri event (e.g., `screenshot:keybind-failed`) with the key combo and error message, so the detection toast system can display it.
5. **Return registration status**: Make `registerHotkeys` return a result object indicating which keybinds succeeded/failed, allowing the caller to show feedback.

**File**: `src/hooks/useDetectionToast.ts`

**Specific Changes**:
6. **Listen for keybind failure event**: Add a listener for `screenshot:keybind-failed` that calls `showToast` with the failure message.

#### Bug 3 Fix: Overlay Detection Result Relay

**File**: `src/overlay/Overlay.tsx`

**Function**: `handleDetect()`

**Specific Changes**:
7. **Add event listeners in overlay**: Listen for `screenshot:item-detected` and `screenshot:detection-failed` in the overlay component. On success, show a brief "✓ Item detected" indicator in the overlay and emit an event to focus/raise the main window. On failure, show a brief "✗" indicator.
8. **Emit focus event**: After detection succeeds from overlay, emit an event (e.g., `screenshot:overlay-detected`) that the main window listens for to bring itself to front or flash the taskbar.

#### Bug 4 Fix: Block Detection Without Active Session

**File**: `src/hooks/useScreenshotDetection.ts`

**Function**: `triggerManual()` and `confirm()`

**Specific Changes**:
9. **Add session guard to `triggerManual`**: Before calling `detectFromClipboard()`, check if there's an active session (via a prop/callback or by checking runs). If no session, call `onError("Start a session first to detect items")` and return early.
10. **Remove `getOrCreateRunId` auto-creation**: Change `getOrCreateRunId` to return `null` when no active run exists instead of creating a standalone run. If it returns null, block the confirm and show a toast.
11. **Pass session state from App.tsx**: The `useScreenshotDetection` hook needs to know whether a session is active. Add a `sessionActive` parameter or check the runs list for an active (unfinished) run.

**File**: `src/overlay/Overlay.tsx`

**Specific Changes**:
12. **Guard overlay detect button**: When `state.sessionActive` is false, show the toast "Start a session first" instead of invoking detection. The overlay already has `state.sessionActive` from the `overlay-state-update` event.

#### Bug 5 Fix: Overlay Item Count Display

**File**: `src/pages/RunTracker.tsx`

**Specific Changes**:
13. **Add `runItemCount` to overlay-state-update payload**: Include the current run's item count in the emitted event payload. This data is already available in RunTracker via the items list for the current run.

**File**: `src/overlay/Overlay.tsx`

**Specific Changes**:
14. **Display item count in overlay**: Add `runItemCount` to the `OverlayState` interface and render it in the overlay stats section (e.g., "Items: 3").
15. **Update on item add from overlay**: When `overlay_add_item` succeeds, the RunTracker will re-emit `overlay-state-update` with the updated count on its next tick.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that exercise each of the five bug paths on unfixed code and observe failures.

**Test Cases**:
1. **Folder source not checked on manual trigger**: Call `triggerManual()` with `folder_monitoring_enabled: true` and a new file in the folder → assert file is NOT processed (confirms bug on unfixed code)
2. **Folder watcher not started on app launch**: Simulate app startup with `folder_monitoring_enabled: true` in settings → assert `FolderWatcherState` is `None` (confirms bug)
3. **Keybind silent failure**: Call `registerHotkeys()` with a key combo that causes `register()` to throw → assert no toast/event is emitted (confirms bug)
4. **Overlay no result relay**: Simulate overlay detect button click followed by `screenshot:item-detected` event → assert overlay has no listener registered (confirms bug)
5. **No session guard**: Call `triggerManual()` with no active run → assert `getOrCreateRunId` creates a new run (confirms bug)
6. **Missing item count in overlay**: Inspect `overlay-state-update` payload → assert `runItemCount` field is undefined (confirms bug)

**Expected Counterexamples**:
- Manual trigger only checks clipboard, never polls folder
- App startup leaves `FolderWatcherState` as `None`
- `registerHotkeys` catch block only logs to console
- Overlay's `handleDetect` has empty catch block with no event listeners
- `getOrCreateRunId` unconditionally creates runs

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := detectScreenshot'(input)

  IF input.folderMonitoringEnabled AND input.newFilesInFolder THEN
    ASSERT folder_files_processed(result) = TRUE
  END IF

  IF input.triggerSource = "app_startup" AND input.folderMonitoringEnabled THEN
    ASSERT folder_watcher_running(result) = TRUE
  END IF

  IF input.shortcutRegistrationFailed THEN
    ASSERT toast_displayed(result, keybind_failure_message)
  END IF

  IF input.triggerSource = "overlay_button" AND input.detectionCompleted THEN
    ASSERT main_window_notified(result) = TRUE
    ASSERT overlay_shows_status(result) = TRUE
  END IF

  IF input.hasActiveSession = FALSE THEN
    ASSERT detection_blocked(result) = TRUE
    ASSERT toast_displayed(result, "Start a session first to detect items")
  END IF

  IF input.sessionActive AND input.overlayVisible THEN
    ASSERT overlay_item_count_displayed(result) = TRUE
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT detectScreenshot(input) = detectScreenshot'(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random profiles, detection results, overlay states)
- It catches edge cases in event emission and state management
- It provides strong guarantees that clipboard detection, toasts, and keybind flows are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for clipboard detection, working keybinds, and overlay state updates, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Clipboard Detection Preservation**: Verify that `detect_from_clipboard` with a valid clipboard image still emits `screenshot:item-detected` or `screenshot:detection-failed` identically
2. **Working Keybind Preservation**: Verify that keybinds that register successfully (F9, F10, F11) continue to fire their actions
3. **Overlay State Update Preservation**: Verify that `overlay-state-update` continues to include all existing fields (`sessionActive`, `paused`, `sessionElapsed`, `runElapsed`, `sessionRunCount`, `totalRunCount`, `area`)
4. **Detection Toast Preservation**: Verify that `screenshot:detection-failed` events still map to the correct toast messages via `mapReasonToMessage`
5. **No Profile Guard Preservation**: Verify that triggering detection without a selected profile still shows "Select a profile first" toast

### Unit Tests

- Test `registerHotkeys` emits failure event when `register()` throws
- Test `triggerManual` blocks and calls `onError` when no active session
- Test `getOrCreateRunId` returns null (not creates) when no active run
- Test overlay `handleDetect` shows status indicator on success/failure events
- Test `overlay-state-update` payload includes `runItemCount` field
- Test folder watcher auto-start logic in setup reads persisted settings
- Test `detect_from_clipboard` polls folder when `folder_monitoring_enabled` is true

### Property-Based Tests

- Generate random `ScreenshotSettings` states and verify folder watcher auto-start only when `folder_monitoring_enabled` is true
- Generate random keybind configurations and verify registration failure always produces user feedback
- Generate random overlay states with varying `runItemCount` values and verify display correctness
- Generate random detection trigger inputs and verify session guard blocks all paths when no session exists
- Generate random `DetectionResult` payloads and verify the overlay relay correctly notifies the main window

### Integration Tests

- Full flow: enable folder monitoring → restart app → verify watcher starts → add file to folder → verify detection fires
- Full flow: configure keybind with conflicting combo → verify toast shows failure message
- Full flow: open overlay → click detect → verify main window shows ConfirmationDialog or overlay shows status
- Full flow: no active session → trigger detection from sidebar/overlay/keybind → verify all blocked with toast
- Full flow: active session with items → verify overlay shows correct item count in real-time
