# Bugfix Requirements Document

## Introduction

The overlay editor feature introduced in v5.1.0 is fundamentally broken and must be completely removed. It replaced the simple, working overlay (`Overlay.tsx`) with a profile-driven widget renderer (`OverlayRenderer.tsx`) that crashes the app, produces broken layouts, freezes when switching profiles, and fails to save. The fix is to revert the overlay window to render the original `Overlay.tsx` and remove all overlay editor code, backend commands, types, and documentation references.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the overlay window loads and `OverlayRenderer` fetches the active profile from the database THEN the system crashes with an unhandled error

1.2 WHEN the overlay renders widgets from a profile layout THEN the system displays widgets overlapping at wrong positions with broken layout

1.3 WHEN the user switches between overlay profiles in the editor THEN the system freezes and becomes unresponsive

1.4 WHEN the user edits and saves an overlay profile in the editor THEN the system fails to persist the changes correctly

1.5 WHEN `overlay/main.tsx` renders the overlay window THEN the system imports and mounts `OverlayRenderer` instead of the working `Overlay` component

### Expected Behavior (Correct)

2.1 WHEN the overlay window loads THEN the system SHALL render the original `Overlay.tsx` component which listens for `overlay-state-update` events without any database interaction for layout

2.2 WHEN the overlay displays session data THEN the system SHALL show a fixed layout with session timer, run timer, run count, area, and control buttons (split, pause, stop, add item, detect screenshot)

2.3 WHEN `overlay/main.tsx` renders the overlay window THEN the system SHALL import and mount the `Overlay` component directly

2.4 WHEN the application starts THEN the system SHALL NOT attempt to initialize default overlay profiles or register overlay profile commands

2.5 WHEN the user navigates the sidebar THEN the system SHALL NOT display an "Overlay Editor" navigation entry

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user toggles overlay visibility from the main app THEN the system SHALL CONTINUE TO show/hide the overlay window

3.2 WHEN a session is active and the overlay is visible THEN the system SHALL CONTINUE TO receive `overlay-state-update` events and display real-time session timer, run timer, run count, and area

3.3 WHEN the user clicks control buttons (split, pause, stop) on the overlay THEN the system SHALL CONTINUE TO invoke `overlay_action` and `overlay_add_item` commands correctly

3.4 WHEN no session is active THEN the system SHALL CONTINUE TO display the idle state with the "No active session" message and detect screenshot button

3.5 WHEN the user drags the overlay window THEN the system SHALL CONTINUE TO allow repositioning via mouse drag on non-interactive areas

3.6 WHEN the user clicks the add item (+) button on the overlay THEN the system SHALL CONTINUE TO show the item search interface and add selected items via `overlay_add_item`

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type OverlayRenderRequest
  OUTPUT: boolean
  
  // The bug condition is always true because OverlayRenderer is always
  // mounted instead of Overlay — every overlay render triggers the broken path
  RETURN X.renderer = "OverlayRenderer"
END FUNCTION
```

## Property Specification

```pascal
// Property: Fix Checking — Overlay renders without crashes or DB dependency
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderOverlay'(X)
  ASSERT no_crash(result)
    AND result.component = "Overlay"
    AND result.layout = "fixed_hardcoded"
    AND NOT requires_database_profile(result)
END FOR
```

## Preservation Goal

```pascal
// Property: Preservation Checking — Original overlay behavior unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  // Non-buggy inputs are overlay interactions (toggle, drag, buttons, state updates)
  // These must work identically before and after the fix
  ASSERT F(X) = F'(X)
END FOR
```
