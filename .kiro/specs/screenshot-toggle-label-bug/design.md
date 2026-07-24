# Screenshot Toggle Label Bug - Bugfix Design

## Overview

The toggle buttons in Screenshot Detection settings display overlapping text ("ONF") when switching from OFF to ON. The root cause is the `.hotkey-btn.recording` CSS class applying a `pulse` opacity animation (`opacity: 0.6` at 50%) which was designed for hotkey recording feedback but is incorrectly reused for ON/OFF toggle states. When React updates text content ("OFF"→"ON") and adds the `recording` class on the same frame, the opacity animation causes a visual artifact where both old and new text briefly overlap. The fix removes the pulse animation from toggle buttons and replaces it with a distinct static visual style for the active (ON) state.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a toggle button transitions from OFF to ON, applying the `recording` class with `pulse` animation simultaneously with text content change
- **Property (P)**: The desired behavior — toggle buttons display only the current label ("ON" or "OFF") at all times with no overlapping frames
- **Preservation**: Existing behavior that must remain unchanged — hotkey recording buttons keep their pulse animation, mouse clicks continue to work, settings persist correctly
- **`pulse` animation**: The CSS `@keyframes pulse` that oscillates opacity between 1 and 0.6, defined in `src/App.css`
- **`.hotkey-btn.recording`**: The CSS class applied to buttons in an active state (originally for hotkey recording, reused for toggle ON state)
- **`.toggle-btn`**: The CSS class for ON/OFF toggle buttons in ScreenshotSettings

## Bug Details

### Bug Condition

The bug manifests when a toggle button transitions from OFF to ON state. React updates the text content (from "OFF" to "ON") and simultaneously adds the `recording` class, which triggers the `pulse` opacity animation. The browser compositor renders both old and new text content in a single frame due to the opacity transition from 1→0.6, producing an "ONF" artifact.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ToggleStateChange
  OUTPUT: boolean
  
  RETURN input.previousState == "OFF"
         AND input.newState == "ON"
         AND element.classList.contains("hotkey-btn", "toggle-btn")
         AND cssRuleApplied(element, "animation: pulse 1s infinite")
         AND textContentChangedOnSameFrame(element, "OFF", "ON")
END FUNCTION
```

### Examples

- **Clipboard Monitoring OFF→ON**: User clicks the "OFF" button, React sets text to "ON" and adds `recording` class → "ONF" flashes briefly before settling to "ON"
- **Auto-Detection OFF→ON**: Same mechanism — toggling from OFF to ON produces "ONF" overlap
- **Any toggle ON→OFF**: User clicks "ON", `recording` class is removed, text changes to "OFF" — less visible because the animation is being removed rather than added, but may still produce a brief flicker
- **Hotkey recording button**: User clicks "Press a key..." button for hotkey capture — this is NOT affected because the text content doesn't change character-by-character in a conflicting way

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Hotkey recording buttons (non-toggle `.hotkey-btn.recording` without `.toggle-btn`) must continue to use the `pulse` animation for visual feedback during key capture
- Mouse clicks on toggle buttons must continue to persist settings via the backend API
- The confidence threshold input must continue to validate and save correctly
- Toggle buttons in the OFF state must continue to display "OFF" in default text color without animation
- The overall `.hotkey-btn` base styling (padding, background, border-radius, font) must remain unchanged

**Scope:**
All inputs that do NOT involve toggle button state transitions with the `recording` class should be completely unaffected by this fix. This includes:
- Hotkey recording flow (`.hotkey-btn.recording` without `.toggle-btn`)
- Confidence threshold input interactions
- Toggle button clicks (the click handling and API calls)
- Any other settings panel functionality

## Hypothesized Root Cause

Based on the CSS and component analysis, the confirmed root causes are:

1. **Inappropriate Animation Reuse**: The `recording` class was designed for hotkey capture feedback (pulsing to indicate "listening for key input"). It was reused for toggle ON state, but its opacity animation conflicts with text content changes.
   - `.hotkey-btn.recording` applies `animation: pulse 1s infinite`
   - `@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`
   - Opacity animation on the same frame as text change causes compositor to blend old/new text

2. **Width Override Conflict**: `.hotkey-btn` has `min-width: 120px` while `.hotkey-btn.recording` overrides to `width: 60px`. This sudden width collapse on the same frame as text change may contribute to the layout instability that makes the overlap more visible.

3. **No Toggle-Specific Active Style**: There is no `.hotkey-btn.toggle-btn.recording` rule to override the pulse animation for toggle buttons specifically. The existing `.hotkey-btn.toggle-btn` only sets width but doesn't address the animation.

4. **Same-Frame Class + Text Update**: React updates DOM text and class simultaneously in one render. The browser doesn't get a chance to paint the clean state before the animation kicks in, causing a single composite frame with both text values visible at partial opacity.

## Correctness Properties

Property 1: Bug Condition - Toggle Label Displays Only Current State

_For any_ toggle button state change where the button transitions from OFF to ON (isBugCondition returns true), the fixed CSS SHALL render only the text "ON" with no overlapping residual "OFF" text visible in any frame, using a static visual style (no opacity animation) for the active state.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Hotkey Recording Animation Unchanged

_For any_ button interaction that is NOT a toggle button state change (isBugCondition returns false), the fixed CSS SHALL produce the same visual behavior as the original code, preserving the pulse animation for hotkey recording buttons, mouse click functionality, and all non-toggle styling.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `src/App.css`

**Selectors affected**: `.hotkey-btn.recording`, `.hotkey-btn.toggle-btn`

**Specific Changes**:

1. **Add toggle-specific active state rule**: Create a new `.hotkey-btn.toggle-btn.recording` selector that overrides the `animation` property to `none`, removing the pulse for toggle buttons while keeping it for hotkey recording buttons.

2. **Apply static active visual style**: Replace the pulse animation for toggle buttons with a solid visual indicator:
   - `border-color: var(--success)` (green border — already inherited from `.recording`)
   - `background: rgba(var(--success-rgb, 34, 197, 94), 0.1)` (subtle green background tint)
   - `color: var(--success)` (green text — already inherited from `.recording`)
   - `animation: none` (explicitly disable pulse)

3. **Remove width override conflict**: The `.hotkey-btn.toggle-btn` already sets `width: 60px`, so the `.recording` override to `width: 60px` is redundant for toggles. Ensure toggle width remains stable at 60px across both states to prevent layout shift.

4. **Keep pulse animation intact**: The `@keyframes pulse` definition and its application in `.hotkey-btn.recording` remain unchanged — they continue to serve the hotkey recording use case.

5. **Ensure transition smoothness**: Add `transition: background-color 0.2s, border-color 0.2s, color 0.2s` to `.hotkey-btn.toggle-btn` so state changes appear smooth without requiring animation.

**File**: `src/components/ScreenshotSettings.tsx`

**No changes required**: The component already uses the correct class composition (`hotkey-btn toggle-btn recording`). The fix is purely CSS — the new `.hotkey-btn.toggle-btn.recording` selector will take effect based on existing markup.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write visual regression tests that capture toggle button state transitions and inspect rendered frames for overlapping text. Run these tests on the UNFIXED code to observe the "ONF" artifact.

**Test Cases**:
1. **Monitoring Toggle OFF→ON**: Simulate clicking the Clipboard Monitoring toggle from OFF to ON, capture rendered text content (will show "ONF" artifact on unfixed code)
2. **Auto-Detection Toggle OFF→ON**: Simulate clicking the Auto-Detection toggle from OFF to ON (will show "ONF" artifact on unfixed code)
3. **Rapid Toggle**: Click toggle multiple times quickly to stress-test the transition (may show "ONF" on unfixed code)
4. **CSS Class Verification**: Assert that `.hotkey-btn.toggle-btn.recording` does NOT have `animation: pulse` applied (will fail on unfixed code since no such override exists)

**Expected Counterexamples**:
- Toggle buttons display "ONF" during OFF→ON transition due to opacity animation blending old/new text
- Possible causes confirmed: pulse animation opacity + same-frame text/class update

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed CSS produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderToggleButton_fixed(input)
  ASSERT result.visibleText == "ON"
  ASSERT result.computedStyle.animation == "none"
  ASSERT result.computedStyle.borderColor == successColor
  ASSERT noOverlappingTextInAnyFrame(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderOriginal(input) = renderFixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-toggle-animation scenarios

**Test Plan**: Observe behavior on UNFIXED code first for hotkey recording buttons and mouse clicks, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Hotkey Recording Pulse Preserved**: Verify that `.hotkey-btn.recording` (without `.toggle-btn`) still applies `animation: pulse 1s infinite` after the fix
2. **Toggle OFF State Preserved**: Verify that toggle buttons without `.recording` class display "OFF" in default color with no animation
3. **Click Handler Preservation**: Verify that clicking toggles still calls the API and updates state correctly
4. **Threshold Input Preservation**: Verify that confidence threshold validation and persistence continue to work

### Unit Tests

- Test that `.hotkey-btn.toggle-btn.recording` has `animation: none` in computed styles
- Test that `.hotkey-btn.recording` (without `.toggle-btn`) still has `animation: pulse 1s infinite`
- Test that toggle button text content shows only "ON" or "OFF" after state change (not "ONF")
- Test that toggle button click handlers continue to call API correctly

### Property-Based Tests

- Generate random sequences of toggle state changes and verify the rendered text is always exactly "ON" or "OFF" with no intermediate values
- Generate random button configurations (toggle vs hotkey) and verify correct animation assignment (pulse for hotkey, none for toggle)
- Test across many rapid click sequences that no visual artifact appears

### Integration Tests

- Test full settings panel flow: load settings, toggle monitoring, verify displayed state matches saved state
- Test that toggling between ON and OFF multiple times never produces visual artifacts
- Test that hotkey recording buttons elsewhere in the app still pulse correctly after the CSS fix
