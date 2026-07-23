# Implementation Plan: Customizable Overlay Layouts

## Overview

This plan implements a profile-driven overlay customization system. The work is organized from backend data models through frontend editor components to the live overlay renderer, with each step building on the previous. The Rust backend handles profile persistence in SQLite, the frontend provides a visual drag-and-drop editor, and Tauri events synchronize changes to the overlay window in real-time.

## Tasks

- [x] 1. Define TypeScript types and validation utilities
  - [x] 1.1 Add overlay profile types to `src/types.ts`
    - Add `WidgetType`, `WidgetSize`, `WidgetPlacement`, `OverlayProfileLayout`, `OverlayProfile`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput` interfaces
    - Add `WIDGET_TYPES` constant array with all 9 widget type strings
    - Add `WIDGET_SIZE_SCALES` map: small → 0.75, medium → 1.0, large → 1.5
    - _Requirements: 1.1, 3.1, 8.1_

  - [x] 1.2 Create overlay profile validation and clamping utilities in `src/overlay/overlay-profile-utils.ts`
    - Implement `clampWidgetOpacity(value: number): number` — clamps to [0.1, 1.0]
    - Implement `clampBackgroundOpacity(value: number): number` — clamps to [0.0, 1.0]
    - Implement `clampDimensions(width: number, height: number): { width: number; height: number }` — clamps width to [200, 800], height to [100, 600]
    - Implement `clampWidgetPosition(x, y, widgetWidth, widgetHeight, canvasWidth, canvasHeight): { x, y }` — ensures widget bounding box stays within canvas
    - Implement `validateProfileName(name: string, existingNames: string[]): { valid: boolean; error?: string }` — checks 1–50 chars trimmed, unique
    - Implement `isValidWidgetSize(size: string): size is WidgetSize` — checks "small" | "medium" | "large"
    - Implement `isValidWidgetType(type: string): type is WidgetType` — checks all 9 types
    - Implement `validateProfileLayout(json: unknown): { valid: boolean; layout?: OverlayProfileLayout; error?: string }` — full JSON validation with type/range checks
    - _Requirements: 2.3, 3.1, 4.1, 4.2, 4.7, 5.6, 6.2, 8.2, 8.3, 8.5, 9.1, 9.5_

  - [x] 1.3 Write property tests for validation utilities in `src/overlay/overlay-profiles.property.test.ts`
    - **Property 6: Widget opacity is always clamped to [0.1, 1.0]**
    - **Property 7: Background opacity is always clamped to [0.0, 1.0]**
    - **Property 11: Overlay dimensions are always clamped to valid range**
    - **Property 12: Widget size is always one of the three valid values**
    - **Property 2: Widget positions are always within canvas bounds**
    - **Property 3: Profile name validation accepts valid names and rejects invalid ones**
    - **Validates: Requirements 2.3, 3.1, 4.1, 4.2, 4.7, 5.1, 5.6, 6.2, 9.1, 9.5**

- [x] 2. Implement Rust backend for overlay profiles
  - [x] 2.1 Add overlay profile models to `src-tauri/src/models.rs`
    - Add `OverlayProfile`, `OverlayProfileLayout`, `WidgetPlacement`, `CreateOverlayProfileInput`, `UpdateOverlayProfileInput` structs with Serialize/Deserialize derives
    - _Requirements: 8.1_

  - [x] 2.2 Add `overlay_profiles` table migration in `src-tauri/src/db.rs`
    - Add `CREATE TABLE IF NOT EXISTS overlay_profiles` with columns: id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, layout_json TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    - Add index on `is_active` column
    - _Requirements: 4.5, 8.1_

  - [x] 2.3 Create overlay profile commands in `src-tauri/src/overlay_commands.rs`
    - Implement `get_overlay_profiles` — fetches all profiles, deserializes layout_json
    - Implement `get_active_overlay_profile` — fetches where is_active = 1
    - Implement `create_overlay_profile` — validates name (1–50 chars, unique), enforces max 20 limit, generates UUID, serializes layout, sets created_at/updated_at
    - Implement `update_overlay_profile` — validates name if provided, updates layout_json and/or name, updates updated_at
    - Implement `delete_overlay_profile` — rejects if only 1 profile remains, if deleting active profile activates first remaining
    - Implement `set_active_overlay_profile` — sets is_active=0 on all, is_active=1 on target
    - Implement `init_default_overlay_profiles` — creates Compact, Streamer, Detailed defaults if no profiles exist
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 10.1, 10.2, 10.3, 10.4_

  - [x] 2.4 Register overlay commands in `src-tauri/src/lib.rs`
    - Add `mod overlay_commands;` declaration
    - Register all 7 overlay commands in `generate_handler![]`
    - Call `init_default_overlay_profiles` during app setup after DB initialization
    - _Requirements: 4.5, 10.1_

- [x] 3. Checkpoint - Backend compilation and verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add frontend API layer and profile logic
  - [x] 4.1 Add overlay profile API functions to `src/api.ts`
    - Add `getOverlayProfiles`, `getActiveOverlayProfile`, `createOverlayProfile`, `updateOverlayProfile`, `deleteOverlayProfile`, `setActiveOverlayProfile` functions using the `invoke` pattern from existing code
    - _Requirements: 4.5_

  - [x] 4.2 Create profile management hook in `src/hooks/useOverlayProfiles.ts`
    - Implement `useOverlayProfiles()` hook that manages profile state: list, active profile, loading state
    - Provide `createProfile`, `updateProfile`, `deleteProfile`, `switchProfile` methods that call API and update local state
    - Emit `overlay-profile-update` Tauri event when active profile layout changes
    - Enforce max 20 profile limit on the frontend
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.8, 7.1_

  - [x] 4.3 Write property tests for profile management logic in `src/overlay/overlay-profiles.property.test.ts`
    - **Property 1: Widget removal decrements list**
    - **Property 4: Cannot delete the last remaining profile**
    - **Property 5: Profile count never exceeds 20**
    - **Validates: Requirements 1.3, 4.3, 4.8**

  - [x] 4.4 Write property tests for serialization in `src/overlay/overlay-profiles.property.test.ts`
    - **Property 8: Profile serialization round-trip**
    - **Property 9: Validation rejects malformed profile JSON**
    - **Property 10: Unknown fields are ignored during deserialization**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 5. Build overlay editor UI components
  - [x] 5.1 Create `ProfileManager` component in `src/components/overlay-editor/ProfileManager.tsx`
    - Render dropdown/list of all profiles with active indicator
    - Create profile button with name input (validates 1–50 chars, uniqueness)
    - Rename inline editing with same validation
    - Delete button with confirmation (disabled when only 1 profile)
    - Switch profile on selection
    - Display error messages for duplicate names and max profile limit
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

  - [x] 5.2 Create `WidgetLibrary` component in `src/components/overlay-editor/WidgetLibrary.tsx`
    - Display all 9 widget types as draggable items using @dnd-kit
    - Show widget name and icon/indicator for each type
    - Visually distinguish already-placed widgets from available ones
    - Support drag-start to initiate placement on the canvas
    - _Requirements: 1.1, 1.6, 2.1_

  - [x] 5.3 Create `PreviewCanvas` component in `src/components/overlay-editor/PreviewCanvas.tsx`
    - Render scaled canvas matching overlay aspect ratio
    - Accept drops from WidgetLibrary using @dnd-kit DndContext
    - Render placed widgets at their (x, y) positions with correct size and opacity
    - Support drag-to-reposition for placed widgets, constraining within bounds
    - Cancel placement when dropped outside canvas
    - Display placeholder text for each widget type
    - Apply background color and opacity from profile settings
    - _Requirements: 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 5.2, 6.3, 7.2_

  - [x] 5.4 Create `PropertyInspector` component in `src/components/overlay-editor/PropertyInspector.tsx`
    - Show controls when a widget is selected on the canvas
    - Size selector with small/medium/large options
    - Opacity slider from 0.1 to 1.0 in 0.01 increments
    - Right-click context menu or remove button to delete widget
    - Persist changes to active profile on every change
    - _Requirements: 1.3, 3.1, 3.2, 3.4, 3.5, 5.1, 5.2, 5.4, 5.5_

  - [x] 5.5 Create `BackgroundSettings` component in `src/components/overlay-editor/BackgroundSettings.tsx`
    - Color picker input accepting hex values, defaulting to #000000
    - Background opacity slider from 0.0 to 1.0 in 0.05 increments, defaulting to 0.85
    - Live update preview canvas on change
    - Persist to active profile
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.6 Create `DimensionControls` component in `src/components/overlay-editor/DimensionControls.tsx`
    - Width input clamped to [200, 800], height input clamped to [100, 600]
    - Default 400×300 for new profiles
    - On dimension change: resize preview canvas, constrain any out-of-bounds widgets
    - Persist to active profile
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 6. Checkpoint - Editor components compile and render
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build overlay editor page and live sync
  - [x] 7.1 Create `OverlayEditor` page in `src/pages/OverlayEditor.tsx`
    - Compose ProfileManager, WidgetLibrary, PreviewCanvas, PropertyInspector, BackgroundSettings, DimensionControls
    - Wrap in @dnd-kit DndContext with collision detection
    - Load active profile on mount, save on every change
    - Emit `overlay-profile-update` event to overlay window on every layout change within 100ms
    - _Requirements: 1.6, 2.1, 7.1, 7.2, 7.3, 7.4_

  - [x] 7.2 Add OverlayEditor route to `src/App.tsx`
    - Add navigation entry for the overlay editor page
    - _Requirements: 1.6_

  - [x] 7.3 Write unit tests for OverlayEditor interactions in `src/overlay/overlay-editor.test.ts`
    - Test widget registry contains all 9 types
    - Test default widget values (size: medium, opacity: 1.0)
    - Test default profile creation (Compact, Streamer, Detailed with correct widgets)
    - Test size-to-scale-factor mapping
    - Test placeholder text generation for each widget type
    - Test background defaults (#000000, 0.85)
    - _Requirements: 1.1, 1.2, 3.4, 5.4, 6.5, 10.2, 10.3, 10.4_

- [x] 8. Implement profile-driven overlay renderer
  - [x] 8.1 Create `OverlayWidget` component in `src/overlay/OverlayWidget.tsx`
    - Render individual widget at absolute (x, y) position
    - Apply size scale factor (0.75/1.0/1.5) to font-size
    - Apply widget opacity
    - Display real session data based on widget type (timer, run_timer, etc.)
    - Show placeholder text when data unavailable (e.g., "No route active" for route_step)
    - _Requirements: 1.4, 1.5, 3.3, 5.3_

  - [x] 8.2 Create `OverlayRenderer` component in `src/overlay/OverlayRenderer.tsx`
    - Replace current fixed `Overlay.tsx` layout with profile-driven rendering
    - On mount: fetch active profile via `get_active_overlay_profile` command
    - Listen for `overlay-profile-update` event and re-render widget layout
    - Continue listening for existing `overlay-state-update` event for session data
    - Apply background color and opacity from profile
    - Set overlay window size from profile dimensions (non-resizable by drag)
    - Preserve existing overlay controls (split, pause, stop, item search)
    - _Requirements: 1.4, 4.4, 6.4, 7.1, 9.4_

  - [x] 8.3 Update `src/overlay/main.tsx` to use `OverlayRenderer` instead of `Overlay`
    - Import and render `OverlayRenderer` as the root overlay component
    - _Requirements: 1.4_

- [x] 9. Wire default profile migration and startup logic
  - [x] 9.1 Implement default profile initialization on frontend startup
    - Call `init_default_overlay_profiles` on app launch (already registered in backend)
    - Handle existing window position migration: if saved overlay position exists, apply to active profile
    - Ensure Compact is set as active when creating defaults
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.2 Write unit tests for default profiles in `src/overlay/overlay-editor.test.ts`
    - Test Compact profile contains: timer, run_timer, run_count at medium size, 300×120 dimensions
    - Test Streamer profile contains: timer, run_timer, run_count, last_item, items_found
    - Test Detailed profile contains all 8 specified widgets
    - Test default background: #000000, opacity 0.85
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (fast-check v4.9.0)
- Unit tests validate specific examples and edge cases
- The existing `Overlay.tsx` is preserved during development and only replaced in task 8.3
- @dnd-kit is already in package.json — no installation needed
- Rust commands follow the existing pattern in `src-tauri/src/commands.rs`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "2.3"] },
    { "id": 3, "tasks": ["2.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1", "5.2"] },
    { "id": 6, "tasks": ["4.3", "4.4", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 9, "tasks": ["8.2"] },
    { "id": 10, "tasks": ["8.3", "9.1"] },
    { "id": 11, "tasks": ["9.2"] }
  ]
}
```
