# Implementation Plan: Screenshot Detection UX Improvements

## Overview

This plan implements three UX improvements to the existing screenshot detection system: (1) backend error reporting with structured failure events, (2) frontend toast notifications for detection feedback, (3) an overlay detection button, (4) a configurable global hotkey, and (5) profile check integration via localStorage. The implementation proceeds backend-first, then frontend infrastructure, then integration points.

## Tasks

- [x] 1. Backend error reporting
  - [x] 1.1 Add `DetectionFailedPayload` struct and emit failure events in `process_image`
    - Add `DetectionFailedPayload` struct with `reason` and `message` fields to `src-tauri/src/screenshot/monitor.rs`
    - Modify `process_image` to emit `screenshot:detection-failed` event with reason `"no_text"` when OCR returns empty text
    - Modify `process_image` to emit `screenshot:detection-failed` event with reason `"no_match"` when all match scores are ≤ 30
    - Existing success path (emitting `screenshot:item-detected`) remains unchanged
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 1.2 Modify `detect_once` to return error with "no_image" reason code
    - Update `detect_once` in `src-tauri/src/screenshot/monitor.rs` to return `Err("no_image: No image found in clipboard")` when clipboard has no image
    - Ensure the error string contains "no_image" as a distinguishable code
    - _Requirements: 5.1_

  - [x] 1.3 Write Rust unit tests for failure event emission
    - Test `detect_once` returns error containing "no_image" when clipboard has no image (mock clipboard)
    - Test `process_image` emits `screenshot:detection-failed` with reason "no_text" when OCR returns empty
    - Test `process_image` emits `screenshot:detection-failed` with reason "no_match" when all scores ≤ 30
    - Test `process_image` does NOT emit failure event when matches are found
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Frontend toast hook and component
  - [x] 2.1 Create `useDetectionToast` hook at `src/hooks/useDetectionToast.ts`
    - Implement hook that listens for `screenshot:detection-failed` events via Tauri `listen`
    - Map `reason` to user-facing messages: "no_image" → "No image found in clipboard", "no_text" → "No text detected in screenshot", "no_match" → "No item detected in screenshot"
    - Provide `showToast(message)` for imperative triggers (e.g., "no profile" case)
    - Provide `dismissToast()` to clear state immediately
    - Auto-dismiss after 4000ms; replace previous toast and reset timer on new trigger
    - Catch `detect_from_clipboard` command errors containing "no_image" and show toast immediately
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 5.4, 5.6_

  - [x] 2.2 Create `DetectionToast` component at `src/components/DetectionToast.tsx`
    - Render toast message in bottom-right of main window via fixed positioning
    - Include close button that is keyboard-focusable (tabIndex={0}) and activatable with Enter/Space
    - Accept `message` and `onDismiss` props
    - Ensure toast does not block UI interaction (no overlay/backdrop)
    - _Requirements: 1.5, 1.7_

  - [x] 2.3 Integrate `DetectionToast` in `App.tsx`
    - Add `useDetectionToast` hook in `App` component
    - Render `DetectionToast` when toast state is visible
    - Wire `showToast` to be called from the existing `useScreenshotDetection` trigger when profile is null
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [x] 2.4 Write unit tests for `useDetectionToast` hook
    - Test listens for `screenshot:detection-failed` events and maps reason to message
    - Test `showToast` sets message state
    - Test auto-dismisses after 4000ms (fake timers)
    - Test replacing a toast resets the timer
    - Test `dismissToast` clears state immediately
    - Test unknown reason maps to a fallback generic message
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 5.4_

  - [x] 2.5 Write unit tests for `DetectionToast` component
    - Test renders message text and close button
    - Test close button is keyboard-focusable (has tabIndex)
    - Test close button responds to Enter and Space keydown
    - Test fixed positioning in bottom-right (style assertions)
    - _Requirements: 1.5, 1.7_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Overlay detection button
  - [x] 4.1 Add detection button to `Overlay.tsx` in both idle and active states
    - In idle state: render ◫ button in the `overlay-header` area alongside the close button
    - In active state: render ◫ button in the `overlay-controls` bar alongside existing split/pause/stop/item buttons
    - Button invokes `detect_from_clipboard` via Tauri `invoke`
    - Use CSS classes `ov-btn ov-detect` with same 44×30px dimensions as existing buttons
    - Ensure keyboard accessibility (Enter/Space activate)
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 4.2 Add CSS for `.ov-detect` button in `src/overlay/overlay.css`
    - Style with `background: var(--ov-item-bg)` and `color: var(--ov-text)`
    - Same dimensions (44×30px) and hover behavior as existing `ov-btn` buttons
    - Add visible focus indicator with ≥ 3:1 contrast ratio
    - _Requirements: 3.3, 3.6_

  - [x] 4.3 Write unit tests for overlay detection button
    - Test button renders in idle state (overlay-header area)
    - Test button renders in active state (overlay-controls bar)
    - Test click invokes `detect_from_clipboard` (mocked)
    - Test uses `ov-btn ov-detect` classes with ◫ icon
    - Test keyboard accessible (Enter/Space activate)
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 5. Configurable global hotkey
  - [x] 5.1 Extend hotkey configuration with `detectScreenshot` field
    - Add `detectScreenshot: ""` to `DEFAULT_HOTKEYS` in `src/pages/Settings.tsx`
    - Update `HotkeyConfig` type to include the new field
    - Add "Detect Screenshot" row to the hotkey settings UI displaying "Not set" when empty
    - _Requirements: 4.1, 4.2, 4.8_

  - [x] 5.2 Implement conflict detection in hotkey recording
    - Before saving a new binding, check if the key combination is already used by another hotkey slot
    - If conflict detected, reject the binding, retain previous value, and display status message "Key combination already in use"
    - Apply conflict detection to all hotkey slots (including detectScreenshot)
    - _Requirements: 4.9_

  - [x] 5.3 Register `detectScreenshot` hotkey in `registerHotkeys()`
    - If `detectScreenshot` is non-empty, register it as a global shortcut
    - On press, read `d2r_active_profile_id` from localStorage
    - If profile ID exists, invoke `detect_from_clipboard`
    - If profile ID is null/missing, emit a `screenshot:no-profile` event (picked up by toast hook)
    - Handle registration failure gracefully (log warning, do not crash)
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.10_

  - [x] 5.4 Implement hotkey clearing (unregister on empty binding)
    - When user clears the detectScreenshot binding, call `unregister` for that shortcut
    - Ensure the key combination is released back to the OS
    - _Requirements: 4.7_

  - [x] 5.5 Write unit tests for hotkey settings UI
    - Test "Detect Screenshot" row renders alongside existing rows
    - Test default value displays "Not set"
    - Test recording mode captures key combination
    - Test conflict detection rejects duplicate bindings with status message
    - Test clearing binding calls unregister
    - _Requirements: 4.1, 4.2, 4.8, 4.9_

  - [x] 5.6 Write property test for hotkey configuration round-trip (Property 1)
    - **Property 1: Hotkey configuration persistence round-trip**
    - For any valid `HotkeyConfig` object, `loadHotkeys(saveHotkeys(config))` produces identical output
    - Use `fast-check` arbitrary objects with 4 string fields (empty or modifier+key combos)
    - **Validates: Requirements 4.6**

  - [x] 5.7 Write property test for hotkey conflict detection (Property 2)
    - **Property 2: Hotkey conflict detection prevents duplicate bindings**
    - For any config state and non-empty key K already assigned to one slot, assigning K to a different slot is rejected
    - Use `fast-check` with arbitrary HotkeyConfig state + random key combo + random target slot
    - **Validates: Requirements 4.9**

- [x] 6. Profile check integration
  - [x] 6.1 Store selected profile ID in localStorage
    - In `App.tsx`, when `selectedProfile` changes, write `selectedProfile.id` to `localStorage` key `d2r_active_profile_id`
    - When profile is deselected (null), remove the key from localStorage
    - _Requirements: 2.1, 2.3_

  - [x] 6.2 Add profile check to `useDetectionToast` hook for event-based triggers
    - When the hotkey emits a `screenshot:no-profile` event, show "Select a profile first to log items" toast
    - Ensure toast follows same feedback rules (auto-dismiss 4s, replaceable, dismissable)
    - _Requirements: 2.1, 4.5_

  - [x] 6.3 Write unit tests for profile check integration
    - Test localStorage is updated when profile changes
    - Test localStorage key is removed when profile is deselected
    - Test "Select a profile first" toast appears when hotkey fires with no profile
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend changes (Rust) are in `src-tauri/src/screenshot/monitor.rs`
- Frontend changes (TypeScript/React) are in `src/hooks/`, `src/components/`, `src/pages/`, and `src/overlay/`
- The `fast-check` library is already in devDependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2", "6.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "4.2"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.3", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4"] },
    { "id": 6, "tasks": ["5.5", "5.6", "5.7", "6.2"] },
    { "id": 7, "tasks": ["6.3"] }
  ]
}
```
