# Widget Mode Fix — Bugfix Design

## Overview

The Widget Mode is a non-functional stub that renders only a "D2R" logo when idle and shows only run count + session time when active. It lacks configurable stat display, useful idle content, and Linux compositor window rule documentation. This fix transforms the widget into a functional, configurable ultra-compact stats display while preserving its existing window behavior, drag support, theme integration, and event-driven architecture.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when the widget renders in either idle or active state and shows only hardcoded minimal content with no configurability
- **Property (P)**: The desired behavior — idle state shows profile name + total runs; active state shows user-configured stats from the available data set
- **Preservation**: Existing window configuration (200x50px, frameless, transparent, always-on-top, skip-taskbar), drag-to-reposition, real-time event updates via `overlay-state-update`, independent operation from overlay, theme switching
- **Widget**: The React component in `src/widget/Widget.tsx` rendered in a separate Tauri window (`widget.html`)
- **overlay-state-update**: The Tauri cross-window event emitted by RunTracker every tick with session state data
- **Widget Preferences**: A localStorage-based configuration object controlling which stats the widget displays

## Bug Details

### Bug Condition

The bug manifests whenever the widget renders — in idle state it shows only "D2R" text with zero useful information, and in active state it shows only `sessionRunCount | sessionElapsed` with no way to configure the display. The widget has no mechanism to receive profile information or fastest time data, and no settings exist for stat selection.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { widgetState: "idle" | "active", statsDisplayed: string[], configurable: boolean }
  OUTPUT: boolean
  
  RETURN (input.widgetState == "idle" AND input.statsDisplayed == ["logo_only"])
         OR (input.widgetState == "active" AND input.statsDisplayed == ["sessionRunCount", "sessionElapsed"] AND input.configurable == false)
END FUNCTION
```

### Examples

- **Idle with no session**: Widget shows "D2R" text only — expected: profile name "Blizzard Sorc" and total run count "142 runs"
- **Active session, user wants run timer**: Widget shows "5 | 00:12:34" — expected: user-configured stats e.g. "Run #5 | 00:01:23" (run timer instead of session time)
- **Active session, user wants area + fastest**: Widget shows "5 | 00:12:34" — expected: "Chaos | 00:01:05" (area + fastest time)
- **Linux Hyprland user opens widget**: Widget tiles to full width — expected: floats at 200x50px with documented window rules

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Widget window configuration remains 200x50px, frameless, transparent, always-on-top, skip-taskbar, initially hidden
- Widget remains draggable via mouseDown → `getCurrentWindow().startDragging()`
- Widget continues to receive state updates via `overlay-state-update` event from RunTracker
- Widget operates independently from the overlay — both can be visible simultaneously
- Widget applies dark/light theme from `localStorage.getItem("d2r-theme")`
- The `overlay-state-update` event payload continues to include all fields it currently has (no breaking changes for the Overlay component)

**Scope:**
All inputs that do NOT involve widget rendering or widget settings are completely unaffected by this fix. This includes:
- Overlay window behavior and display
- RunTracker session logic, timing, and run management
- All other Settings sections (hotkeys, sound, OBS, backup, terror zones)
- Main window navigation and all other pages

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Incomplete Event Payload**: The `overlay-state-update` event emitted by RunTracker does not include `profileName` or `fastestTime` — the widget has no way to display them even if it wanted to. The event needs to be enriched or a separate `widget-state-update` event created.

2. **Hardcoded Rendering Logic**: `Widget.tsx` has hardcoded render paths — idle returns only `<span className="widget-logo">D2R</span>` and active returns only `sessionRunCount | formatTime(sessionElapsed)`. There is no dynamic stat selection logic.

3. **No Preference Storage**: No `getWidgetPrefs()` / `saveWidgetPrefs()` functions exist. The widget has no mechanism to read user preferences for which stats to display.

4. **No Settings UI**: The Settings page (`Settings.tsx`) has no "Widget" section. Users cannot configure widget stat selection anywhere in the app.

5. **Missing Documentation**: The README documents Linux compositor window rules for "D2R Overlay" but not for "D2R Widget" (title from `tauri.conf.json`).

## Correctness Properties

Property 1: Bug Condition — Widget Displays Configurable Stats

_For any_ widget render where `isBugCondition` returns true (idle showing only logo, or active showing only hardcoded run count + session time with no configurability), the fixed widget SHALL display useful, user-configurable stats: in idle state showing profile name and total run count, and in active state showing the user's selected 2-3 stats from the available set.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Existing Widget Infrastructure Unchanged

_For any_ interaction with the widget that does NOT involve stat display content (window configuration, dragging, event subscription, theme application, independent operation from overlay), the fixed code SHALL produce exactly the same behavior as the original code, preserving the widget's window behavior, drag support, event-driven architecture, and theme integration.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/RunTracker.tsx`

**Function**: `useEffect` that calls `emit("overlay-state-update", ...)`

**Specific Changes**:
1. **Enrich event payload**: Add `profileName` (from `profile.name`) and `fastestTime` (from state) to the `overlay-state-update` event payload. These are additive fields — the Overlay component will simply ignore them, preserving backward compatibility.

---

**File**: `src/widget/Widget.tsx`

**Component**: `Widget`

**Specific Changes**:
2. **Add widget preferences state**: Import and use a `getWidgetPrefs()` function to read which stats the user wants displayed. Default to `["sessionRunCount", "sessionTime"]` for backward-compatible initial behavior.

3. **Fix idle state rendering**: Replace the logo-only idle render with a display of `profileName` and `totalRunCount` from the event payload.

4. **Fix active state rendering**: Replace the hardcoded two-stat render with a dynamic renderer that maps the user's selected stat keys to formatted display values from the event payload.

5. **Update OverlayState interface**: Add `profileName?: string` and `fastestTime?: number | null` to the interface.

---

**File**: `src/pages/Settings.tsx`

**New Section**: `WidgetSettings` component

**Specific Changes**:
6. **Add Widget settings section**: Create a `WidgetSettings` component with checkboxes/toggles for selecting which stats to display in the widget (max 3). Persist to localStorage via `saveWidgetPrefs()`.

7. **Export preference functions**: Add `getWidgetPrefs()` and `saveWidgetPrefs()` exported functions following the same pattern as `getObsPrefs()` / `saveObsPrefs()`.

---

**File**: `README.md`

**Section**: Below the existing Overlay Linux window rules

**Specific Changes**:
8. **Add widget window rules documentation**: Document Hyprland and Niri window rules for title `D2R Widget`, following the same format as the overlay rules. Include `float`, `pin`, `noborder`, `noshadow`, `nofocus` rules and add size constraint (`size 200 50`).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the Widget component with mocked event data and assert what content is displayed. Run these tests on the UNFIXED code to observe the limited rendering.

**Test Cases**:
1. **Idle State Test**: Render Widget with `sessionActive: false` — assert only "D2R" logo text is present, no profile name or run count (will confirm bug on unfixed code)
2. **Active State Test**: Render Widget with `sessionActive: true` and rich payload — assert only run count and session time are shown, other stats absent (will confirm bug on unfixed code)
3. **No Configurability Test**: Check that no localStorage key for widget preferences is read — confirm no preference mechanism exists (will confirm bug on unfixed code)
4. **Missing Payload Fields Test**: Check that event payload lacks `profileName` and `fastestTime` — confirm RunTracker doesn't emit them (will confirm bug on unfixed code)

**Expected Counterexamples**:
- Widget idle render contains no profile name or total run count
- Widget active render contains no configurable stats, only hardcoded `sessionRunCount | sessionElapsed`
- Possible causes: hardcoded render logic, incomplete event payload, no preference storage

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderWidget_fixed(input)
  IF input.widgetState == "idle" THEN
    ASSERT result.contains(profileName)
    ASSERT result.contains(totalRunCount)
  ELSE
    ASSERT result.displaysStats(userConfiguredStats)
    ASSERT userConfiguredStats.length >= 2 AND userConfiguredStats.length <= 3
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT widgetWindow_original(input) = widgetWindow_fixed(input)
  // Window config, drag behavior, event subscription, theme, overlay independence
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various event payloads, theme states, drag interactions)
- It catches edge cases that manual unit tests might miss (e.g., empty profile names, zero run counts, null fastest times)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for drag interactions, theme application, and event subscription, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Drag Preservation**: Verify that mouseDown on non-button elements still calls `getCurrentWindow().startDragging()` after fix
2. **Theme Preservation**: Verify that `data-theme` attribute is set from localStorage on mount after fix
3. **Event Subscription Preservation**: Verify that widget still subscribes to `overlay-state-update` and processes payload correctly
4. **Overlay Independence Preservation**: Verify that overlay component still works with the enriched event payload (ignores new fields)

### Unit Tests

- Test Widget idle state renders profile name and total run count
- Test Widget active state renders user-selected stats from preferences
- Test Widget defaults to run count + session time when no preferences saved
- Test Widget handles missing/null `profileName` and `fastestTime` gracefully
- Test `getWidgetPrefs()` returns defaults when localStorage is empty
- Test `saveWidgetPrefs()` persists to correct localStorage key
- Test Widget truncates long profile names for 200px width constraint
- Test Overlay component still renders correctly with enriched payload (backward compat)

### Property-Based Tests

- Generate random event payloads (varying `sessionActive`, `profileName`, stat values) and verify widget always renders valid content for configured stats
- Generate random widget preference combinations (1-3 stats from available set) and verify the widget renders exactly the selected stats
- Generate random event payloads and verify the Overlay component renders identically before and after the payload enrichment (preservation)

### Integration Tests

- Test full flow: configure widget stats in Settings → start session in RunTracker → verify widget displays selected stats
- Test that changing widget preferences in Settings is reflected on next widget render cycle
- Test that widget and overlay receive the same event and both render correctly simultaneously
- Test widget behavior across theme switches during an active session
