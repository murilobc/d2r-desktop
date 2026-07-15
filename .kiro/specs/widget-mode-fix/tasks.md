# Implementation Plan

## Overview

This task list implements the Widget Mode fix using the bug condition methodology. The workflow is: (1) write exploration tests to confirm the bug exists on unfixed code, (2) write preservation tests to capture existing behavior, (3) implement the fix across 4 files (RunTracker.tsx, Widget.tsx, Settings.tsx, README.md), and (4) verify all tests pass.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Widget Displays Only Hardcoded Minimal Content
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the widget renders only "D2R" when idle and only `sessionRunCount | sessionElapsed` when active, with no configurability
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Idle state: Widget should display `profileName` and `totalRunCount` but currently shows only "D2R" logo
    - Active state: Widget should render user-configured stats from preferences but currently shows only hardcoded run count + session time
  - Test file: `src/widget/Widget.test.tsx` (extend existing test file)
  - Test setup: Render Widget component with mocked `overlay-state-update` event containing `profileName: "Blizzard Sorc"`, `totalRunCount: 142`, `fastestTime: 65`, `sessionActive: true/false`
  - **Idle state assertion**: Expect rendered output to contain profile name "Blizzard Sorc" and total run count "142" (from `isBugCondition`: `widgetState == "idle" AND statsDisplayed == ["logo_only"]`)
  - **Active state assertion**: Expect rendered output to display stats matching user preferences read via `getWidgetPrefs()` from localStorage (from `isBugCondition`: `widgetState == "active" AND configurable == false`)
  - **No configurability assertion**: Expect widget to read a `d2r_widget_prefs` localStorage key for stat selection
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: idle shows only "D2R", active shows only hardcoded stats, no preferences read)
  - Document counterexamples found (e.g., "Widget idle renders only 'D2R' text, no profile name or run count present", "Widget active renders only sessionRunCount and sessionElapsed, ignores fastestTime and area")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Widget Infrastructure Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/widget/Widget.test.tsx` (extend existing test file)
  - Observe on UNFIXED code:
    - Widget container renders with `widget-container` class and responds to mouseDown with `getCurrentWindow().startDragging()`
    - Widget reads theme from `localStorage.getItem("d2r-theme")` and sets `data-theme` attribute on mount
    - Widget subscribes to `overlay-state-update` event via `listen()` and processes payload to update state
    - Widget does NOT call `startDragging()` when mouseDown target is a `<button>`
    - Widget idle state renders with `widget-idle` class
    - Widget active state (when `sessionActive: true`) renders without `widget-idle` class
  - Write property-based tests capturing observed behavior:
    - **Drag preservation**: For all mouseDown events on non-button elements, `getCurrentWindow().startDragging()` is called
    - **Theme preservation**: For any value of `localStorage.getItem("d2r-theme")` (dark, light, null), `document.documentElement.setAttribute("data-theme", theme)` is called with correct value (defaults to "dark" when null)
    - **Event subscription preservation**: Widget subscribes to `overlay-state-update` on mount and unsubscribes on unmount
    - **Button drag guard**: For mouseDown events on `<button>` elements, `startDragging()` is NOT called
    - **State transitions**: For any event payload with `sessionActive: true`, widget renders active mode; for `sessionActive: false`, widget renders idle mode
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline infrastructure behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for Widget Mode non-functional stub

  - [ ] 3.1 Add widget preference functions to Settings.tsx
    - Add `WIDGET_STORAGE_KEY = "d2r_widget_prefs"` constant
    - Add `WidgetPrefs` interface: `{ stats: string[] }` where stats is an array of 2-3 stat keys from available set
    - Add exported `getWidgetPrefs(): WidgetPrefs` function — returns defaults `{ stats: ["sessionRunCount", "sessionTime"] }` when localStorage is empty
    - Add exported `saveWidgetPrefs(prefs: WidgetPrefs)` function — persists to localStorage
    - Available stat keys: `"sessionRunCount"`, `"sessionTime"`, `"runTimer"`, `"area"`, `"fastestTime"`, `"averageTime"`, `"totalRuns"`
    - Follow the same pattern as existing `getObsPrefs()` / `saveObsPrefs()`
    - _Bug_Condition: isBugCondition(input) where configurable == false — no preference mechanism exists_
    - _Expected_Behavior: Widget reads user-configured stat selection from localStorage_
    - _Preservation: All existing Settings sections (hotkeys, sound, OBS, backup, terror zones) unchanged_
    - _Requirements: 2.3, 3.1_

  - [ ] 3.2 Add Widget settings section UI to Settings.tsx
    - Create `WidgetSettings` component with checkboxes for stat selection (max 3, min 2)
    - Display available stats with human-readable labels: Run Count, Session Time, Run Timer, Area, Fastest Time, Average Time, Total Runs
    - Disable unchecked stats when 3 are already selected
    - Persist changes via `saveWidgetPrefs()`
    - Add `<WidgetSettings />` to the Settings page render (after Sound settings)
    - _Bug_Condition: isBugCondition(input) where no settings UI exists for widget configuration_
    - _Expected_Behavior: User can configure which 2-3 stats the widget displays_
    - _Preservation: All other Settings sections render and function identically_
    - _Requirements: 2.3_

  - [ ] 3.3 Enrich overlay-state-update event payload in RunTracker.tsx
    - Add `profileName: profile.name` to the `emit("overlay-state-update", {...})` call
    - Add `fastestTime` (from state) to the emit payload
    - These are additive fields — the Overlay component ignores unknown fields (backward-compatible)
    - _Bug_Condition: isBugCondition(input) where widget cannot display profileName or fastestTime because payload lacks them_
    - _Expected_Behavior: Event payload includes profileName and fastestTime for widget consumption_
    - _Preservation: Overlay component continues to work identically (ignores new fields)_
    - _Requirements: 2.1, 2.2, 3.3, 3.4_

  - [ ] 3.4 Update Widget.tsx — OverlayState interface and preferences
    - Add `profileName?: string` and `fastestTime?: number | null` to the `OverlayState` interface
    - Import `getWidgetPrefs` from Settings (or define inline if circular dependency)
    - Add state for widget preferences: `const [prefs] = useState(() => getWidgetPrefs())`
    - _Bug_Condition: Widget interface lacks profileName/fastestTime, no preference reading_
    - _Expected_Behavior: Widget has access to full event data and user preferences_
    - _Preservation: Existing OverlayState fields unchanged, event subscription unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.3_

  - [ ] 3.5 Fix Widget.tsx idle state rendering
    - Replace `<span className="widget-logo">D2R</span>` with display of `state.profileName` (or "D2R" fallback) and `state.totalRunCount` formatted as "{count} runs"
    - Handle edge cases: missing/undefined profileName defaults to "D2R", zero totalRunCount shows "0 runs"
    - Keep `widget-idle` class on container for styling
    - _Bug_Condition: isBugCondition(input) where widgetState == "idle" AND statsDisplayed == ["logo_only"]_
    - _Expected_Behavior: Idle widget shows profile name + total run count_
    - _Preservation: Widget container, drag behavior, theme application unchanged_
    - _Requirements: 2.1, 3.1, 3.2_

  - [ ] 3.6 Fix Widget.tsx active state rendering
    - Replace hardcoded `sessionRunCount | sessionElapsed` with dynamic stat renderer
    - Create a stat renderer that maps each stat key from preferences to its formatted value from event payload:
      - `"sessionRunCount"` → `state.sessionRunCount`
      - `"sessionTime"` → `formatTime(state.sessionElapsed)`
      - `"runTimer"` → `formatTime(state.runElapsed)`
      - `"area"` → `state.area`
      - `"fastestTime"` → `formatTime(state.fastestTime * 10)` or "--:--:--" if null
      - `"averageTime"` → calculated or "--:--:--" if unavailable
      - `"totalRuns"` → `state.totalRunCount`
    - Render stats separated by `|` divider, matching existing styling pattern
    - _Bug_Condition: isBugCondition(input) where widgetState == "active" AND statsDisplayed == ["sessionRunCount", "sessionElapsed"] AND configurable == false_
    - _Expected_Behavior: Active widget shows user's selected 2-3 stats from preferences_
    - _Preservation: Widget container, drag, theme, event subscription unchanged_
    - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.7 Add Linux tiling compositor window rules to README.md
    - Add a "Widget" section below the existing Overlay Linux window rules
    - Document Hyprland rules for title `D2R Widget`: float, pin, noborder, noshadow, nofocus, size 200 50
    - Document Niri rules following same format if applicable
    - Follow the exact format of the existing overlay documentation
    - _Bug_Condition: isBugCondition(input) where Linux compositor ignores widget dimensions due to missing documentation_
    - _Expected_Behavior: README documents window rules for "D2R Widget" title_
    - _Preservation: Existing overlay documentation unchanged_
    - _Requirements: 2.4, 3.1_

  - [ ] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Widget Displays Configurable Stats
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (idle shows profile + runs, active shows configured stats)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Widget Infrastructure Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (drag, theme, event subscription, button guard, state transitions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run TypeScript compilation: `npx tsc --noEmit`
  - Verify all widget tests pass (both exploration and preservation)
  - Verify no regressions in existing test files (RunTracker, Settings, etc.)
  - Ensure all tests pass, ask the user if questions arise.


## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2"],
    ["3.1", "3.7"],
    ["3.2", "3.3"],
    ["3.4"],
    ["3.5", "3.6"],
    ["3.8", "3.9"],
    ["4"]
  ]
}
```

## Notes

- The exploration test (task 1) is expected to FAIL on unfixed code — this confirms the bug exists
- The preservation test (task 2) is expected to PASS on unfixed code — this captures baseline behavior
- After implementation (tasks 3.1-3.7), re-running both test sets validates the fix
- The widget preference functions follow the same localStorage pattern as existing `getObsPrefs()` / `saveObsPrefs()`
- Event payload enrichment is additive and backward-compatible — the Overlay component ignores unknown fields
- Test runner: Vitest + Testing Library (`npm test` or `npx vitest --run`)
