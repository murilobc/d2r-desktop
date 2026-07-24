# Screenshot Detection No-Feedback Fix — Bugfix Design

## Overview

When the user clicks "Detect Screenshot" and the clipboard has no image, `detectFromClipboard()` rejects with a "no_image" error. The `triggerManual` function catches this error but only logs it to `console.error`, leaving the user with zero visual feedback. The fix connects this catch path to the existing `showToast` API exposed by `useDetectionToast`, so that users see a "No image found in clipboard" toast notification instead of silence.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — `detectFromClipboard()` rejecting with a "no_image" error when the clipboard has no image data
- **Property (P)**: The desired behavior — `showToast("No image found in clipboard")` is invoked so the user sees immediate visual feedback
- **Preservation**: All non-"no_image" detection flows (successful detection, "no_text", "no_match", no-profile guard) must remain unchanged
- **`triggerManual`**: The callback in `useScreenshotDetection.ts` that calls `detectFromClipboard()` and catches errors
- **`showToast`**: The function returned by `useDetectionToast` that displays a temporary notification message
- **`detectFromClipboard`**: Tauri command wrapper in `api.ts` — calls backend clipboard detection; rejects with "no_image" if clipboard lacks image data

## Bug Details

### Bug Condition

The bug manifests when the user triggers manual screenshot detection (via the sidebar button) while the clipboard contains no image data. The `detectFromClipboard()` promise rejects with an error containing "no_image", which `triggerManual` catches and silently logs, never invoking the toast system.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ManualDetectionTrigger
  OUTPUT: boolean

  RETURN input.source = "manual_button_click"
         AND detectFromClipboard() rejects
         AND error.message CONTAINS "no_image"
         AND showToast WAS NOT called
END FUNCTION
```

### Examples

- User copies text to clipboard, clicks "Detect Screenshot" → expected: toast shows "No image found in clipboard"; actual: nothing happens
- User has empty clipboard, clicks "Detect Screenshot" → expected: toast shows "No image found in clipboard"; actual: only `console.error` fires
- User copies an image, clicks "Detect Screenshot" → detection proceeds normally (not a bug condition)
- User clicks "Detect Screenshot" with no profile selected → existing no-profile guard shows toast (not a bug condition, already handled)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful clipboard detection (image present, item matched) must continue to emit `screenshot:item-detected` and display the ConfirmationDialog
- Backend-emitted `screenshot:detection-failed` events with reason "no_text" or "no_match" must continue to trigger the toast via the existing event listener in `useDetectionToast`
- The no-profile guard in App.tsx (which calls `showToast("Select a profile first to log items")`) must continue to work as before
- Mouse clicks on the sidebar button must continue to invoke `triggerManual` identically
- The `useScreenshotDetection` hook's other functionality (detection state, confirm, dismiss, auto-dismiss timer) must remain unchanged

**Scope:**
All inputs that do NOT result in a "no_image" rejected promise from `detectFromClipboard()` should be completely unaffected by this fix. This includes:
- Successful detections (item found)
- Event-based failures ("no_text", "no_match") — these already produce toasts via the event listener
- No-profile scenarios — already guarded in App.tsx before `triggerManual` is even reachable
- Other errors from `detectFromClipboard()` (network errors, unexpected failures)

## Hypothesized Root Cause

Based on the bug description, the root cause is an architectural gap:

1. **Missing error-to-toast bridge**: `triggerManual` in `useScreenshotDetection.ts` is a self-contained callback that catches errors internally. It has no access to `showToast` because `useDetectionToast` is a separate hook used in App.tsx. The catch block was written as a fire-and-forget logging statement with no mechanism to surface the error to the UI.

2. **Asymmetric error delivery**: The Rust backend handles "no_text" and "no_match" by emitting Tauri events (which `useDetectionToast` listens to), but "no_image" is returned as a command error (rejected promise). This means the event-listener approach in `useDetectionToast` never receives it.

3. **No callback/option for error reporting**: `useScreenshotDetection` does not accept an `onError` callback or expose the error state, so the consuming component (App.tsx) has no way to react to the failure.

## Correctness Properties

Property 1: Bug Condition - No-Image Error Triggers Toast

_For any_ manual detection trigger where `detectFromClipboard()` rejects with a "no_image" error, the fixed code SHALL invoke `showToast("No image found in clipboard")` so that the user receives immediate visual feedback within the toast auto-dismiss window.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-No-Image Flows Unchanged

_For any_ manual detection trigger where `detectFromClipboard()` does NOT reject with a "no_image" error (including successful detection, event-based failures, and other error types), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing detection, event-emission, and toast flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/hooks/useScreenshotDetection.ts`

**Function**: `triggerManual`

**Specific Changes**:

1. **Accept an `onError` callback parameter**: Modify `useScreenshotDetection` to accept an optional `onError` callback (or specifically an `onNoImage` callback) that `triggerManual` can invoke when it catches a "no_image" error from `detectFromClipboard()`.

2. **Invoke callback in catch block**: In the `.catch()` handler of `triggerManual`, check if the error message contains "no_image" and, if so, call the provided `onError` callback with the appropriate message.

3. **Pass `showToast` from App.tsx**: In App.tsx where `useScreenshotDetection` is called, pass `showToast` (from `useDetectionToast`) as the error callback so that "no_image" errors produce a toast.

**Alternative approach (simpler):**

**File**: `src/App.tsx`

**Change**: Instead of modifying the hook's interface, wrap the `triggerManual` call in App.tsx's button `onClick` to catch the error at the call site. However, since `triggerManual` currently catches internally and does not re-throw, the preferred approach is to modify the hook.

**Recommended implementation:**

```typescript
// In useScreenshotDetection.ts — add onError parameter
export function useScreenshotDetection(
  profileId: string | null,
  onError?: (message: string) => void
): UseScreenshotDetection {
  // ...existing code...

  const triggerManual = useCallback(() => {
    detectFromClipboard().catch((error) => {
      console.error("Manual detection failed:", error);
      if (onError) {
        const msg = String(error);
        if (msg.includes("no_image")) {
          onError("No image found in clipboard");
        } else {
          onError("Screenshot detection failed");
        }
      }
    });
  }, [onError]);

  // ...
}
```

```typescript
// In App.tsx — pass showToast as onError
const { detection, dismiss: dismissDetection, confirm: confirmDetection, triggerManual } =
  useScreenshotDetection(selectedProfile?.id ?? null, showToast);
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that mock `detectFromClipboard` to reject with a "no_image" error, call `triggerManual`, and assert that `showToast` is called. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **No-Image Rejection Test**: Mock `detectFromClipboard` to reject with "no_image", call `triggerManual` → assert `showToast` called (will fail on unfixed code)
2. **Generic Error Rejection Test**: Mock `detectFromClipboard` to reject with a generic error, call `triggerManual` → assert `showToast` called with fallback message (will fail on unfixed code)
3. **Empty Clipboard Test**: Simulate empty clipboard scenario end-to-end (will fail on unfixed code)

**Expected Counterexamples**:
- `showToast` is never invoked when `detectFromClipboard` rejects
- The error is only visible in `console.error` output
- Root cause confirmed: catch block has no path to the toast system

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := triggerManual_fixed(input)
  ASSERT showToast_was_called WITH message = "No image found in clipboard"
  ASSERT console.error_was_also_called (logging preserved)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT triggerManual_original(input) = triggerManual_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various clipboard states, error types)
- It catches edge cases that manual unit tests might miss (e.g., errors that partially match "no_image")
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for successful detections and event-based failures, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Successful Detection Preservation**: Verify that when `detectFromClipboard` resolves successfully, no toast is shown and the event system continues to handle `screenshot:item-detected` as before
2. **Event-Based Failure Preservation**: Verify that "no_text" and "no_match" events still trigger toasts via the existing event listener (not via the new onError path)
3. **No-Profile Guard Preservation**: Verify the no-profile button handler continues to call `showToast("Select a profile first to log items")` independently
4. **Other Hook State Preservation**: Verify `detection`, `dismiss`, `confirm`, and timer behavior remain unchanged

### Unit Tests

- Test that `triggerManual` calls `onError` with "No image found in clipboard" when `detectFromClipboard` rejects with "no_image"
- Test that `triggerManual` calls `onError` with "Screenshot detection failed" when `detectFromClipboard` rejects with an unknown error
- Test that `triggerManual` does NOT call `onError` when `detectFromClipboard` resolves successfully
- Test that `console.error` is still called (logging not removed)

### Property-Based Tests

- Generate random error messages and verify: only errors containing "no_image" produce the specific "No image found in clipboard" toast message; all other errors produce the generic fallback
- Generate random sequences of successful/failed detections and verify the hook state (detection, timer) is never corrupted by the error handling path
- Verify that for any non-rejecting `detectFromClipboard` call, the `onError` callback is never invoked

### Integration Tests

- Test full flow: render App component, simulate button click with mocked rejecting `detectFromClipboard`, assert DetectionToast appears with correct message
- Test that DetectionToast auto-dismisses after 4 seconds (existing AUTO_DISMISS_MS)
- Test that successful detection still shows ConfirmationDialog (not a toast)
- Test that "no_text"/"no_match" events still produce their respective toast messages via the event listener path
