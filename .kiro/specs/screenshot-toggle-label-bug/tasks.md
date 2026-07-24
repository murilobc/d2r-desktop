# Implementation Plan

## Overview

Fix the toggle button text overlap ("ONF") bug in Screenshot Detection settings. The bug occurs because `.hotkey-btn.recording` applies a `pulse` opacity animation simultaneously with React's text content change, causing the browser to render both old ("OFF") and new ("ON") text in the same frame. The fix adds a `.hotkey-btn.toggle-btn.recording` CSS rule that disables the animation and applies a static active style instead.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Toggle Button Pulse Animation Applied on State Change
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that toggle buttons with class `hotkey-btn toggle-btn recording` receive the `pulse` animation (which causes the "ONF" overlap)
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — toggle buttons that have both `toggle-btn` and `recording` classes should NOT have `animation: pulse` applied
  - Create file `src/components/ScreenshotSettings.property.test.tsx`
  - Use fast-check to generate arbitrary toggle scenarios (monitoring ON, auto-detection ON, both ON)
  - Render `ScreenshotSettingsPanel` with settings where toggles are enabled (monitoring_enabled=true and/or auto_detection_enabled=true)
  - For each toggle button with class `hotkey-btn toggle-btn recording`:
    - Assert `getComputedStyle(button).animation` does NOT contain "pulse"
    - Assert the button text content is exactly "ON" (not "ONF" or any other value)
    - Assert there is no opacity animation keyframe affecting the element
  - Also verify: the `.hotkey-btn.toggle-btn.recording` selector exists and overrides animation to `none`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — on unfixed code, no `.hotkey-btn.toggle-btn.recording` rule exists, so toggle buttons inherit the pulse animation from `.hotkey-btn.recording`, proving the bug condition)
  - Document counterexamples found: toggle buttons with `recording` class have `animation: pulse 1s infinite` applied, which causes the text overlap artifact
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Hotkey Recording Pulse and Toggle Click Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create file `src/components/ScreenshotSettings.preservation.property.test.tsx`
  - **Observation phase on UNFIXED code:**
    - Observe: `.hotkey-btn.recording` (without `.toggle-btn`) applies `animation: pulse 1s infinite` — this is the hotkey recording feedback style that must be preserved
    - Observe: clicking the Clipboard Monitoring toggle calls `update_screenshot_settings` with `monitoring_enabled: true`
    - Observe: clicking the Auto-Detection toggle calls `update_screenshot_settings` with `auto_detection_enabled: false` (since it defaults ON)
    - Observe: toggle buttons in OFF state display "OFF" text, have no `recording` class, and no pulse animation
    - Observe: confidence threshold input validates range 50-100 and persists valid values
  - **Write property-based tests:**
    - Property: for all non-toggle `.hotkey-btn.recording` elements, `animation` includes "pulse" (hotkey recording buttons still pulse after fix)
    - Property: for all toggle button click sequences (generated via fast-check), the correct API call is made with the toggled state
    - Property: for all toggle buttons in OFF state (recording class absent), no animation is applied and text is "OFF"
    - Property: for all valid threshold values in range [50, 100], the setting is persisted via API; for all invalid values outside that range, an error is shown and no API call is made
  - Verify all tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for toggle button text overlap ("ONF") during OFF→ON transition

  - [x] 3.1 Implement the CSS fix
    - In `src/App.css`, add a new rule after the existing `.hotkey-btn.toggle-btn` block (around line 1799):
    - Add selector `.hotkey-btn.toggle-btn.recording` with:
      - `animation: none` — disables the pulse animation for toggle buttons
      - `border-color: var(--success)` — green border for active state (inherited but explicit)
      - `color: var(--success)` — green text for active state (inherited but explicit)
      - `background: rgba(34, 197, 94, 0.1)` — subtle green background tint for static active indicator
      - `opacity: 1` — ensure no opacity flicker from the disabled animation
    - Add `transition: background-color 0.2s, border-color 0.2s, color 0.2s` to existing `.hotkey-btn.toggle-btn` rule for smooth state change without animation
    - Do NOT modify the existing `.hotkey-btn.recording` rule (hotkey recording buttons keep their pulse animation)
    - Do NOT modify `@keyframes pulse` definition
    - Do NOT modify `src/components/ScreenshotSettings.tsx` (the fix is purely CSS)
    - _Bug_Condition: isBugCondition(input) where input is a toggle button transitioning OFF→ON, receiving `recording` class with `pulse` animation on the same frame as text change_
    - _Expected_Behavior: Toggle buttons display only "ON" text with static green styling, no pulse animation, no opacity flicker, no text overlap_
    - _Preservation: `.hotkey-btn.recording` without `.toggle-btn` retains pulse animation; all click handlers, API calls, and threshold validation unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Toggle Button Uses Static Active Style
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 asserts that `.hotkey-btn.toggle-btn.recording` does NOT have pulse animation
    - When this test passes, it confirms the expected behavior is satisfied (toggle buttons show clean "ON" text with no animation-induced overlap)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — toggle buttons no longer pulse)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Hotkey Recording Pulse and Toggle Click Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — hotkey buttons still pulse, clicks still work, threshold validation intact)
    - Confirm all preservation tests still pass after fix (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run TypeScript check: `npx tsc --noEmit`
  - Run Vite build: `npx vite build`
  - Ensure all property-based tests pass (both bug condition and preservation)
  - Ensure existing `ScreenshotSettings.test.tsx` unit tests still pass
  - Ask the user if questions arise

## Notes

- The bug condition is purely visual/CSS: the `pulse` opacity animation causes the browser compositor to blend old and new text content during the OFF→ON transition
- The fix is additive CSS only — a new more-specific selector `.hotkey-btn.toggle-btn.recording` overrides the animation without touching any existing rules or React components
- Property-based tests use fast-check with vitest, matching existing project patterns (e.g., `RuneCell.property.test.tsx`, `Settings.property.test.ts`)
- Since JSDOM doesn't compute real CSS animations, the tests verify class composition and the absence of inline animation styles; full visual verification requires manual testing
- The higher specificity of `.hotkey-btn.toggle-btn.recording` (3 classes) over `.hotkey-btn.recording` (2 classes) ensures the override applies correctly without `!important`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
