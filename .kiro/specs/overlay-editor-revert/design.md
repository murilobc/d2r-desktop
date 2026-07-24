# Overlay Editor Revert — Bugfix Design

## Overview

The overlay editor feature (introduced in v5.1.0) is completely broken: it crashes on load, produces broken layouts, freezes on profile switch, and fails to save. The fix is a complete revert — delete all overlay editor code and restore the overlay window to render the original working `Overlay.tsx` component. This is a deletion/revert operation that removes ~15 files, modifies ~7 files, and leaves the original overlay and its supporting infrastructure untouched.

## Glossary

- **Bug_Condition (C)**: The overlay window imports and renders `OverlayRenderer` (the broken profile-driven widget system) instead of the working `Overlay` component
- **Property (P)**: The overlay window renders the original `Overlay.tsx` component directly, with no database profile dependency
- **Preservation**: The original overlay behavior (toggle, drag, buttons, state updates, item search, screenshot detection) must remain unchanged
- **OverlayRenderer**: The broken replacement component in `src/overlay/OverlayRenderer.tsx` that fetches active profiles from the DB and renders widgets
- **Overlay**: The working original component in `src/overlay/Overlay.tsx` that listens for `overlay-state-update` events and displays a fixed layout
- **overlay_commands.rs**: The Rust module containing all overlay profile CRUD commands (to be deleted)

## Bug Details

### Bug Condition

The bug manifests unconditionally whenever the overlay window is loaded. The `src/overlay/main.tsx` entry point imports `OverlayRenderer` instead of `Overlay`, which attempts to fetch an active overlay profile from the database and render a widget-based layout. This fails with crashes, broken layouts, freezes, and save failures.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type OverlayRenderRequest
  OUTPUT: boolean
  
  RETURN input.entryPoint = "src/overlay/main.tsx"
         AND input.importedComponent = "OverlayRenderer"
         AND input.requiresDatabaseProfile = true
END FUNCTION
```

### Examples

- User opens the overlay window → `OverlayRenderer` fetches active profile → crashes with unhandled error (no profile exists or DB access fails)
- User has profiles in DB → `OverlayRenderer` renders widgets → widgets overlap at wrong positions with broken layout
- User switches profiles in the editor page → overlay window freezes and becomes unresponsive
- User edits a profile layout and saves → changes fail to persist, overlay shows stale state

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Overlay toggle (show/hide) via the sidebar button must continue to work
- `overlay-state-update` event reception and real-time display of session timer, run timer, run count, and area
- Control buttons (split, pause, stop) invoking `overlay_action` command
- Add item (+) button showing `ItemSearch` and invoking `overlay_add_item` command
- Detect screenshot (◫) button invoking `detect_from_clipboard` command
- Idle state displaying "No active session" message
- Window dragging on non-interactive areas via `startDragging()`
- Overlay window configuration in `tauri.conf.json` (size, position, decorations, transparency, always-on-top)

**Scope:**
All inputs that do NOT involve the overlay editor, overlay profiles, or the `OverlayRenderer` component are completely unaffected by this fix. This includes:
- All main app pages and navigation (profiles, tracker, history, stats, etc.)
- All existing Tauri commands except the 7 overlay profile commands being removed
- All database tables except `overlay_profiles` (which stays but is unused)
- The overlay window's interaction model (it just renders a different component)

## Hypothesized Root Cause

The overlay editor feature was shipped in a broken state. Multiple independent failures exist:

1. **Database Initialization Race**: `OverlayRenderer` calls `get_active_overlay_profile` on mount, but default profiles may not exist yet or the DB call fails, causing an unhandled crash

2. **Layout Rendering Logic**: The widget-based positioning system in `OverlayRenderer` + `OverlayWidget` produces overlapping elements due to incorrect absolute positioning and missing container constraints

3. **Profile Switch Freeze**: The `overlay-profile-update` event listener in `OverlayRenderer` + the state machine in `useOverlayProfiles` creates a deadlock or infinite re-render loop when switching active profiles

4. **Save Failures**: The `update_overlay_profile` command and its JSON serialization/deserialization pipeline has field naming conflicts (`type` vs `widget_type` serde aliasing) causing silent data corruption

Rather than fix each issue individually, the decision is to revert the entire feature since the original `Overlay.tsx` works correctly.

## Correctness Properties

Property 1: Bug Condition - Overlay Renders Without Crashes or DB Dependency

_For any_ overlay render request where the overlay window is loaded, the fixed `src/overlay/main.tsx` SHALL import and mount the `Overlay` component (not `OverlayRenderer`), which renders without any database calls for profile/layout data and displays either the idle state or the active session state based on `overlay-state-update` events.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Original Overlay Interaction Behavior

_For any_ overlay interaction (toggle visibility, receive state updates, click control buttons, drag window, add items, detect screenshots) that does NOT involve the overlay editor or profile system, the fixed code SHALL produce exactly the same behavior as v5.0.3, preserving all existing overlay functionality for session tracking interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

This is a deletion/revert operation. The fix removes all overlay editor code and restores the overlay window entry point.

**Phase 1: Delete Files (no dependency order needed)**

| # | File/Directory | Reason |
|---|---|---|
| 1 | `src/pages/OverlayEditor.tsx` | Overlay editor page component |
| 2 | `src/pages/OverlayEditor.test.tsx` | Test for overlay editor page |
| 3 | `src/pages/OverlayEditor.dnd.property.test.tsx` | DnD property test for overlay editor |
| 4 | `src/components/overlay-editor/` (entire directory) | All 6 components + 4 test files |
| 5 | `src/overlay/OverlayRenderer.tsx` | Broken profile-driven overlay renderer |
| 6 | `src/overlay/OverlayWidget.tsx` | Widget rendering component |
| 7 | `src/overlay/overlay-profile-utils.ts` | Profile validation utilities |
| 8 | `src/overlay/overlay-editor.test.ts` | Test file for overlay editor utils |
| 9 | `src/overlay/overlay-profiles.property.test.ts` | Property test for overlay profiles |
| 10 | `src/hooks/useOverlayProfiles.ts` | Profile state management hook |
| 11 | `src/hooks/useOverlayProfileInit.ts` | Profile initialization hook |
| 12 | `src-tauri/src/overlay_commands.rs` | All overlay profile Rust commands |

**Phase 2: Modify Files**

**File**: `src/overlay/main.tsx`

**Change**: Replace `OverlayRenderer` import with `Overlay` import
- Remove: `import OverlayRenderer from "./OverlayRenderer";`
- Add: `import Overlay from "./Overlay";`
- Replace: `<OverlayRenderer />` → `<Overlay />`

---

**File**: `src/App.tsx`

**Changes**:
1. Remove `const OverlayEditor = lazy(() => import("./pages/OverlayEditor"));`
2. Remove `import { useOverlayProfileInit } from "./hooks/useOverlayProfileInit";`
3. Remove `useOverlayProfileInit();` call
4. Remove `"overlay-editor"` from `Page` type union
5. Remove the `case "overlay-editor": return <OverlayEditor />;` in `renderPage()`
6. Remove the sidebar nav button for "Overlay Editor"

---

**File**: `src/api.ts`

**Changes**: Remove overlay profile API functions and their type imports
- Remove imports: `OverlayProfile`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput`
- Remove functions: `getOverlayProfiles`, `getActiveOverlayProfile`, `createOverlayProfile`, `updateOverlayProfile`, `deleteOverlayProfile`, `setActiveOverlayProfile`

---

**File**: `src/types.ts`

**Changes**: Remove all overlay profile types and constants
- Remove: `WidgetType`, `WidgetSize`, `WidgetPlacement`, `OverlayProfileLayout`, `OverlayProfile`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput` types
- Remove: `WIDGET_TYPES`, `WIDGET_SIZE_SCALES` constants

---

**File**: `src-tauri/src/lib.rs`

**Changes**:
1. Remove `mod overlay_commands;` declaration
2. Remove `overlay_commands::init_default_profiles(&conn).expect(...)` call in setup
3. Remove all 7 overlay commands from `invoke_handler`: `get_overlay_profiles`, `get_active_overlay_profile`, `create_overlay_profile`, `update_overlay_profile`, `delete_overlay_profile`, `set_active_overlay_profile`, `init_default_overlay_profiles`

---

**File**: `src-tauri/src/models.rs`

**Changes**:
- Remove structs: `OverlayProfile`, `OverlayProfileLayout`, `WidgetPlacement`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput`
- Remove test modules: `preservation_tests`, `bug_condition_tests`

---

**File**: `src-tauri/src/db.rs`

**Change**: Remove the call to `migrate_overlay_profiles(conn)?;` from `init_db()`. Keep the `migrate_overlay_profiles` function itself (it's harmless — the table stays in existing DBs but is never used by the application).

---

**File**: `docs/DEVELOPMENT_PLAN_V4.md`

**Changes**:
1. Remove section 7 "Customizable Overlay Layouts" entirely
2. Update "v5.1.0" references to remove "Custom Overlay" from feature lists
3. Update the competitive differentiation table: change "In-game overlay" from "✅ (customizable)" to "✅"
4. Remove "Customizable overlay editor with multiple profiles" from key differentiators
5. Update version planning table to remove "Custom Overlay" from v5.1.0
6. Update priority ranking to remove "Customizable Overlay" row

**Phase 3: Dependency Check**

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — **KEEP**. These are also used by `src/pages/RouteEditor.tsx` for drag-and-drop route step reordering. Do NOT remove from `package.json`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists on unfixed code (overlay crashes when loading OverlayRenderer), then verify the fix (overlay loads Overlay.tsx without crashes and all interactions work).

### Exploratory Bug Condition Checking

**Goal**: Confirm that the current `OverlayRenderer` cannot render without errors. Surface counterexamples demonstrating the broken state BEFORE implementing the fix.

**Test Plan**: Write tests that import `OverlayRenderer`, mock Tauri APIs, and attempt to render it. Observe crash/error behavior. Run these on UNFIXED code to confirm failures.

**Test Cases**:
1. **Load Without Profile**: Render `OverlayRenderer` with no active profile in DB → crashes (will fail on unfixed code)
2. **Load With Profile**: Render `OverlayRenderer` with a mocked active profile → broken layout or render error (will fail on unfixed code)
3. **Profile Switch**: Simulate `overlay-profile-update` event during render → freeze or infinite loop (will fail on unfixed code)
4. **Entry Point Check**: Verify `src/overlay/main.tsx` imports `OverlayRenderer` → confirms bug condition (will pass on unfixed code, used to detect the broken import)

**Expected Counterexamples**:
- `OverlayRenderer` throws unhandled errors when `get_active_overlay_profile` rejects
- Widget layout renders overlapping elements at incorrect positions
- Possible causes: missing error boundary, incorrect DB initialization, serde field conflicts

### Fix Checking

**Goal**: Verify that after the fix, the overlay window loads `Overlay.tsx` directly without any database dependency and renders correctly in both idle and active states.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderOverlay_fixed(input)
  ASSERT result.component = "Overlay"
  ASSERT result.noDBCalls = true
  ASSERT result.noCrash = true
  ASSERT result.rendersIdleOrActiveState = true
END FOR
```

### Preservation Checking

**Goal**: Verify that all overlay interactions (toggle, drag, buttons, state updates, item search) continue to work identically after the fix.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT overlayBehavior_original(input) = overlayBehavior_fixed(input)
END FOR
```

**Testing Approach**: Since `Overlay.tsx` is unchanged (it already exists and works), preservation is guaranteed by the fact that we're restoring the exact same component. Manual verification should confirm:
- Toggle overlay → appears/hides correctly
- Session active → timers, run count, area display correctly
- Buttons (split, pause, stop, +, ◫) → invoke correct commands
- Drag → window moves

**Test Cases**:
1. **Overlay Toggle Preservation**: Verify overlay show/hide works after revert
2. **State Update Preservation**: Verify `overlay-state-update` events display correctly
3. **Control Button Preservation**: Verify split/pause/stop/add-item/detect work
4. **Drag Preservation**: Verify window dragging on non-interactive areas

### Unit Tests

- Test that `src/overlay/main.tsx` imports `Overlay` (not `OverlayRenderer`)
- Test that `App.tsx` does not contain "overlay-editor" page or navigation
- Test that `lib.rs` does not register overlay profile commands
- Test that `src/types.ts` does not export overlay profile types

### Property-Based Tests

- Not applicable for this fix. This is a pure deletion/revert operation. The restored `Overlay.tsx` component is unchanged and already tested by its existing behavior. Property-based testing is unnecessary when the fix is "remove broken code and use the untouched working code."

### Integration Tests

- Build the project successfully after all deletions (TypeScript `tsc --noEmit`, Rust `cargo check`, Vite build)
- Verify no dead imports or references remain after cleanup
- Verify the overlay window loads and renders correctly (manual test)
