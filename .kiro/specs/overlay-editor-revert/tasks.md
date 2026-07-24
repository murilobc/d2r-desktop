# Implementation Plan

## Overview

Complete removal of the overlay editor feature and restoration of the original `Overlay.tsx` component. This is a pure deletion/revert operation: delete 12 files/directories, modify 7 files, and verify the build passes. No property-based tests needed — the restored component is unchanged and already working.

## Tasks

- [x] 1. Delete overlay editor frontend files
  - Delete `src/pages/OverlayEditor.tsx`
  - Delete `src/pages/OverlayEditor.test.tsx`
  - Delete `src/pages/OverlayEditor.dnd.property.test.tsx`
  - Delete `src/components/overlay-editor/` (entire directory — all components and tests)
  - Delete `src/overlay/OverlayRenderer.tsx`
  - Delete `src/overlay/OverlayWidget.tsx`
  - Delete `src/overlay/overlay-profile-utils.ts`
  - Delete `src/overlay/overlay-editor.test.ts`
  - Delete `src/overlay/overlay-profiles.property.test.ts`
  - Delete `src/hooks/useOverlayProfiles.ts`
  - Delete `src/hooks/useOverlayProfileInit.ts`
  - _Requirements: 1.5, 2.1, 2.3, 2.4, 2.5_

- [x] 2. Delete overlay editor backend files
  - Delete `src-tauri/src/overlay_commands.rs`
  - _Requirements: 2.4_

- [x] 3. Modify `src/overlay/main.tsx` to use Overlay instead of OverlayRenderer
  - Replace `import OverlayRenderer from "./OverlayRenderer";` with `import Overlay from "./Overlay";`
  - Replace `<OverlayRenderer />` with `<Overlay />`
  - _Bug_Condition: isBugCondition(input) where input.importedComponent = "OverlayRenderer"_
  - _Expected_Behavior: overlay entry point imports and mounts Overlay component directly_
  - _Requirements: 1.5, 2.1, 2.3_

- [x] 4. Clean up `src/App.tsx`
  - Remove `const OverlayEditor = lazy(() => import("./pages/OverlayEditor"));`
  - Remove `import { useOverlayProfileInit } from "./hooks/useOverlayProfileInit";`
  - Remove `useOverlayProfileInit();` call inside the App function
  - Remove `"overlay-editor"` from the `Page` type union
  - Remove `case "overlay-editor": return <OverlayEditor />;` from `renderPage()`
  - Remove the sidebar nav `<li>` button for "Overlay Editor" (the `⊞` button)
  - _Requirements: 2.4, 2.5_

- [x] 5. Clean up `src/api.ts`
  - Remove type imports: `OverlayProfile`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput`
  - Remove functions: `getOverlayProfiles`, `getActiveOverlayProfile`, `createOverlayProfile`, `updateOverlayProfile`, `deleteOverlayProfile`, `setActiveOverlayProfile`
  - _Requirements: 2.4_

- [x] 6. Clean up `src/types.ts`
  - Remove type: `WidgetType`
  - Remove type: `WidgetSize`
  - Remove interface: `WidgetPlacement`
  - Remove interface: `OverlayProfileLayout`
  - Remove interface: `OverlayProfile`
  - Remove interface: `CreateOverlayProfileInput`
  - Remove interface: `UpdateOverlayProfileInput`
  - Remove constant: `WIDGET_TYPES`
  - Remove constant: `WIDGET_SIZE_SCALES`
  - Remove the `// ===== CUSTOMIZABLE OVERLAY PROFILES =====` section header comment
  - _Requirements: 2.4_

- [x] 7. Clean up `src-tauri/src/lib.rs`
  - Remove `mod overlay_commands;` declaration
  - Remove `overlay_commands::init_default_profiles(&conn).expect("failed to initialize default overlay profiles");` from setup
  - Remove all 7 overlay commands from `invoke_handler`: `overlay_commands::get_overlay_profiles`, `overlay_commands::get_active_overlay_profile`, `overlay_commands::create_overlay_profile`, `overlay_commands::update_overlay_profile`, `overlay_commands::delete_overlay_profile`, `overlay_commands::set_active_overlay_profile`, `overlay_commands::init_default_overlay_profiles`
  - Remove the `// Overlay Profiles` comment line
  - _Requirements: 2.4_

- [x] 8. Clean up `src-tauri/src/models.rs`
  - Remove structs: `OverlayProfile`, `OverlayProfileLayout`, `WidgetPlacement`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput`
  - Remove the `// ===== OVERLAY PROFILES =====` section header comment
  - Remove `#[cfg(test)] mod preservation_tests` module entirely
  - Remove `#[cfg(test)] mod bug_condition_tests` module entirely
  - _Requirements: 2.4_

- [x] 9. Clean up `src-tauri/src/db.rs`
  - Remove the call `migrate_overlay_profiles(conn)?;` from `init_db()`
  - Remove the comment `// Migration: add overlay_profiles table` above it
  - Keep the `migrate_overlay_profiles` function itself (table stays harmless in existing DBs)
  - _Preservation: Existing databases with overlay_profiles table are unaffected_
  - _Requirements: 2.4_

- [x] 10. Update `docs/DEVELOPMENT_PLAN_V4.md`
  - Remove section 7 "Customizable Overlay Layouts" entirely (header + all content)
  - In competitive differentiation table: change "In-game overlay" from "✅ (customizable)" to "✅"
  - In key differentiators list: remove "Customizable overlay editor with multiple profiles (Compact, Streamer, Detailed)"
  - In version planning table: remove "Custom Overlay" from v5.1.0 features
  - In priority ranking table: remove the "Customizable Overlay | Shipped v5.1.0" row
  - _Requirements: 2.4, 2.5_

- [x] 11. Build verification checkpoint
  - Run `npx tsc --noEmit` — must pass with zero errors
  - Run `cd src-tauri && cargo check` — must pass with zero errors/warnings
  - Run `npx vite build` — must succeed
  - Run `npm test` — all remaining tests must pass
  - Confirm no dead imports or references remain
  - Confirm `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are still in `package.json` (used by RouteEditor)
  - _Preservation: All non-overlay-editor functionality unchanged_
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4", "5", "6", "7", "8", "9", "10"] },
    { "id": 2, "tasks": ["11"] }
  ]
}
```

## Notes

- **@dnd-kit packages MUST be kept** — `RouteEditor.tsx` uses them for drag-and-drop route step reordering
- **DB table `overlay_profiles` stays** — harmless in existing databases, migration function kept but not called from `init_db()`
- **No property-based tests** — this is a pure deletion/revert; the restored `Overlay.tsx` is unchanged working code
- Tasks 1–2 (deletions) should be done first; tasks 3–10 (modifications) can be done in any order after deletions; task 11 (verification) must be last
