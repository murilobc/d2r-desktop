# Implementation Plan

## Overview

Fix the silent failure when the user clicks "Detect Screenshot" with no image in the clipboard. The fix adds an `onError` callback to `useScreenshotDetection` and wires it to `showToast` in App.tsx so that users see feedback instead of silence.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - No-Image Error Silent Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `triggerManual` silently swallows "no_image" errors without invoking `onError`
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — `detectFromClipboard` rejecting with an error containing "no_image"
  - Create file `src/hooks/useScreenshotDetection.property.test.ts`
  - Use fast-check to generate arbitrary error messages containing "no_image" (e.g., `fc.constantFrom("no_image", "error: no_image found", "clipboard no_image")`)
  - Mock `detectFromClipboard` to reject with the generated error message
  - Call `triggerManual` (from `useScreenshotDetection` hook rendered with `renderHook`)
  - Assert that the `onError` callback is called with `"No image found in clipboard"`
  - Also test: for generic errors (not containing "no_image"), assert `onError` is called with `"Screenshot detection failed"`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — the current code has no `onError` parameter, so the callback is never invoked, proving the bug exists)
  - Document counterexamples found: `onError` is never called because `useScreenshotDetection` doesn't accept or invoke an error callback
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Error Detection Flows Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create file `src/hooks/useScreenshotDetection.preservation.property.test.ts`
  - Observe on UNFIXED code: when `detectFromClipboard` resolves successfully, `triggerManual` does not throw or produce side effects beyond setting detection state via the event listener
  - Observe on UNFIXED code: the hook returns `{ detection, dismiss, confirm, triggerManual }` with correct types
  - Observe on UNFIXED code: calling `dismiss` clears detection state and cancels the auto-dismiss timer
  - Write property-based test: for all cases where `detectFromClipboard` resolves (not rejects), no error callback is invoked and detection flow proceeds via the event system
  - Write property-based test: for any sequence of `dismiss`/`confirm` calls, the hook state resets correctly (detection becomes null, timer is cleared)
  - Use fast-check to generate arbitrary successful detection payloads and verify the hook state transitions remain identical
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for silent no-image error in triggerManual

  - [x] 3.1 Add `onError` callback parameter to `useScreenshotDetection`
    - In `src/hooks/useScreenshotDetection.ts`, add optional `onError?: (message: string) => void` as second parameter
    - Update the `triggerManual` callback's catch block to check if error contains "no_image"
    - If "no_image": call `onError("No image found in clipboard")`
    - Otherwise: call `onError("Screenshot detection failed")`
    - Keep existing `console.error` call (logging preserved)
    - Add `onError` to the `useCallback` dependency array for `triggerManual`
    - _Bug_Condition: isBugCondition(input) where detectFromClipboard rejects with error containing "no_image"_
    - _Expected_Behavior: onError("No image found in clipboard") is invoked so user sees toast feedback_
    - _Preservation: All non-rejecting paths and non-"no_image" rejection paths remain unchanged; event-based failures still handled by useDetectionToast listener_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Pass `showToast` as `onError` in App.tsx
    - In `src/App.tsx`, update the `useScreenshotDetection` call to pass `showToast` as the second argument
    - Change: `useScreenshotDetection(selectedProfile?.id ?? null)` → `useScreenshotDetection(selectedProfile?.id ?? null, showToast)`
    - This connects the hook's error path to the existing toast UI system
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No-Image Error Triggers Toast
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (onError called with correct message)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Error Detection Flows Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run TypeScript check: `npx tsc --noEmit`
  - Ensure all property-based tests pass (both bug condition and preservation)
  - Ensure existing `DetectionToast.test.tsx` and `ScreenshotSettings.test.tsx` still pass
  - Ask the user if questions arise

## Notes

- The bug condition is narrow: only `detectFromClipboard` rejections with "no_image" in the error message
- The fix is additive (new optional parameter) so it cannot break existing callers
- Property-based tests use fast-check with vitest, matching existing project patterns
- Preservation tests observe UNFIXED code behavior first, then assert it remains unchanged after the fix

## Task Dependencies

```
1: []
2: []
3.1: [1, 2]
3.2: [3.1]
3.3: [3.2]
3.4: [3.2]
4: [3.3, 3.4]
```
