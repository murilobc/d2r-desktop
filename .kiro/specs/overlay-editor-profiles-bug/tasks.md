# Implementation Plan

## Overview

Fix five interrelated bugs in the Overlay Editor page: (1) legacy JSON deserialization failure due to `"widget_type"` vs `"type"` field mismatch, (2) ghost profiles blocking name reuse, (3) duplicate widget placement allowed, (4) no direct on-canvas widget removal affordance, and (5) missing controller button preview. The fix spans Rust serde attributes, React component logic in OverlayEditor/PreviewCanvas/WidgetLibrary, and CSS. Testing follows the bug condition methodology: first confirm bugs exist on unfixed code, then verify preservation of non-buggy behavior, then apply targeted fixes.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Overlay Editor Profiles Multi-Defect
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: For each bug, scope the property to concrete failing cases:
    - Bug 1 (Rust): Generate `WidgetPlacement` JSON with `"widget_type"` field → assert deserialization succeeds (will fail on unfixed code)
    - Bug 3 (TS): Generate sequences of `addWidget(type, x, y)` calls where `type` is already in `layout.widgets` → assert widget count does not increase (will fail since duplicates are added)
    - Bug 4 (TS): Render `PreviewCanvas` with a selected widget → assert a delete button with `aria-label="Remove <type> widget"` exists (will fail since no button renders)
    - Bug 5 (TS): Render `PreviewCanvas` with a layout → assert controller button elements with `aria-label="Controller buttons preview"` are present (will fail)
  - Create test file `src/components/overlay-editor/PreviewCanvas.bugcondition.test.tsx` for bugs 3, 4, 5
  - Create Rust test in `src-tauri/src/models.rs` (`#[cfg(test)]` module) for bug 1
  - Use `fast-check` to generate arbitrary widget types and positions for the TS property tests
  - Run tests on UNFIXED code: `npm test` and `cd src-tauri && cargo test`
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — proves the bugs exist)
  - Document counterexamples:
    - `serde_json::from_str::<WidgetPlacement>(r#"{"id":"abc","widget_type":"timer","x":10,"y":10,"size":"medium","opacity":1.0}"#)` returns Err
    - Calling `addWidget("timer", 100, 100)` with timer already placed results in 2 timer widgets
    - `queryByLabelText("Remove timer widget")` returns null for selected widget
    - `queryByLabelText("Controller buttons preview")` returns null
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Overlay Editor Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code** (non-buggy inputs where `isBugCondition` returns false):
    - Observe: Deserializing JSON with `"type"` field succeeds and produces correct `WidgetPlacement`
    - Observe: `addWidget("timer", 50, 50)` when NO timer is on canvas → adds exactly one timer widget at (50, 50)
    - Observe: Dragging a widget on canvas updates its x/y coordinates
    - Observe: Property Inspector "Remove Widget" button removes the selected widget
    - Observe: Switching profiles loads the correct layout
  - Write property-based tests:
    - **Rust** (`src-tauri/src/models.rs` test module): For all valid `WidgetPlacement` JSON with `"type"` field → deserialization succeeds and round-trips correctly
    - **TS** (`src/components/overlay-editor/OverlayEditor.preservation.test.tsx`): For all widget types NOT in `layout.widgets` → `addWidget(type, x, y)` increases widget count by exactly 1
    - **TS**: For all (x, y) positions within canvas bounds → dragging a widget to (x, y) updates its position
    - **TS**: For all widgets in layout → Property Inspector remove button removes exactly that widget
  - Use `fast-check` for TS property-based tests and `proptest` or inline tests for Rust
  - Run tests on UNFIXED code: `npm test` and `cd src-tauri && cargo test`
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for Overlay Editor profiles multi-defect

  - [x] 3.1 Add serde alias for backward-compatible deserialization
    - In `src-tauri/src/models.rs`, change `#[serde(rename = "type")]` to `#[serde(rename = "type", alias = "widget_type")]` on the `widget_type` field of `WidgetPlacement`
    - This accepts both `"type"` (current) and `"widget_type"` (legacy) during deserialization
    - Serialization continues to output `"type"` only
    - _Bug_Condition: isBugCondition(input) where layout_json contains "widget_type" field name_
    - _Expected_Behavior: serde_json::from_str succeeds for both "type" and "widget_type"_
    - _Preservation: Profiles with correct "type" field continue to load (Requirement 3.1)_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Add widget deduplication guard in OverlayEditor.tsx
    - In `src/pages/OverlayEditor.tsx`, modify the `addWidget` callback:
      - Add `if (layout.widgets.some((w) => w.type === type)) return;` as early guard
    - Update `handleDragEnd` to perform the same check before calling `addWidget`
    - _Bug_Condition: isBugCondition(input) where input.widget_type IN canvas.placed_widget_types_
    - _Expected_Behavior: Widget count unchanged; duplicate placement silently rejected_
    - _Preservation: First-time widget placement works (Requirement 3.3)_
    - _Requirements: 2.3_

  - [x] 3.3 Disable dragging for already-placed widgets in WidgetLibrary.tsx
    - In `src/components/overlay-editor/WidgetLibrary.tsx`, pass `disabled: isPlaced` to `useDraggable` hook options
    - Add visual indicator (reduced opacity, cursor: not-allowed) when disabled
    - "Placed" badge continues to render as before
    - _Bug_Condition: Prevents drag initiation for placed widget types_
    - _Expected_Behavior: useDraggable does not produce drag events when disabled_
    - _Preservation: Unplaced widgets still draggable (Requirement 3.3)_
    - _Requirements: 2.3_

  - [x] 3.4 Add delete button on selected widgets in PreviewCanvas.tsx
    - In `src/components/overlay-editor/PreviewCanvas.tsx`, modify `DraggableWidget` component
    - When `isSelected` is true, render a `<button className="preview-canvas-widget-delete">` at top-right of widget
    - Button text: "×", calls `onRemove(widget.id)` on click with `e.stopPropagation()`
    - Add `aria-label={`Remove ${widget.type} widget`}` for accessibility
    - Add keyboard handler (Enter/Space) and `tabIndex={0}`
    - _Bug_Condition: isBugCondition(input) where input.method == "canvas_direct" and no button exists_
    - _Expected_Behavior: Delete button visible on selected widget; clicking removes it_
    - _Preservation: Property Inspector removal still works (Requirement 3.4)_
    - _Requirements: 2.4_

  - [x] 3.5 Add static controller button preview in PreviewCanvas.tsx
    - Add a `<div className="preview-canvas-controls" aria-label="Controller buttons preview">` inside the canvas
    - Render four `<span className="preview-ctrl-btn">` elements: ⏭ ⏸ ⏹ ◫
    - Position at bottom of preview area with reduced opacity (0.5) to indicate non-interactive
    - _Bug_Condition: isBugCondition(input) where preview has no controller buttons_
    - _Expected_Behavior: Controller buttons visible in preview canvas_
    - _Preservation: Actual overlay window (OverlayRenderer.tsx) unchanged (Requirement 3.7)_
    - _Requirements: 2.5_

  - [x] 3.6 Wire up onRemoveWidget prop through OverlayEditor
    - Add `onRemoveWidget: (id: string) => void` to `PreviewCanvasProps` interface
    - Pass down to `DraggableWidget` as `onRemove` prop
    - In `OverlayEditor.tsx`, pass existing `removeWidget` function as `onRemoveWidget` to `<PreviewCanvas>`
    - _Bug_Condition: Completes wiring for canvas-direct removal_
    - _Expected_Behavior: Delete button click calls removeWidget and updates layout state_
    - _Preservation: Existing removeWidget logic unchanged_
    - _Requirements: 2.4_

  - [x] 3.7 Add CSS for new elements
    - `.preview-canvas-widget-delete`: absolute top-right, 20px red circle, white × text, hover brightness
    - `.preview-canvas-controls`: flex row at bottom of canvas, gap 8px, opacity 0.5, pointer-events none
    - `.preview-ctrl-btn`: 28px square, border 1px solid rgba(255,255,255,0.3), centered emoji
    - `.widget-library-item--disabled` or update existing placed styles: opacity 0.5, cursor not-allowed
    - Place in existing overlay editor CSS or `src/App.css` following project convention
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Overlay Editor Profiles Multi-Defect
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes expected behavior for all five bug conditions
    - When this test passes, it confirms:
      - Legacy JSON deserialization succeeds
      - Duplicate widget placement is rejected
      - Delete button renders on selected widgets
      - Controller buttons render in preview
    - Run: `npm test` and `cd src-tauri && cargo test`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Overlay Editor Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run: `npm test` and `cd src-tauri && cargo test`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation properties hold:
      - Valid JSON profiles still load
      - Unique profile creation still works
      - First widget placement still works
      - Property Inspector remove still works
      - Widget dragging still works
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test` (frontend) and `cd src-tauri && cargo test` (backend)
  - Run TypeScript compilation: `npx tsc --noEmit`
  - Run Rust check: `cd src-tauri && cargo check`
  - Run Vite build: `npx vite build`
  - Verify zero test failures across all test files
  - Ensure all exploration tests (task 1) now pass
  - Ensure all preservation tests (task 2) still pass
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.4", "3.5"] },
    { "id": 2, "tasks": ["3.3", "3.6", "3.7"] },
    { "id": 3, "tasks": ["3.8", "3.9"] },
    { "id": 4, "tasks": ["4"] }
  ]
}
```

## Notes

- **Files to modify**: `src-tauri/src/models.rs`, `src/pages/OverlayEditor.tsx`, `src/components/overlay-editor/WidgetLibrary.tsx`, `src/components/overlay-editor/PreviewCanvas.tsx`, CSS file
- **Rust change**: Single attribute addition — `alias = "widget_type"` alongside existing `rename = "type"`
- **Bug 2 (ghost profiles)** is resolved implicitly by fixing Bug 1 — once deserialization works, profiles load correctly and names are visible, preventing the "already in use" confusion
- **Wave 0** tasks (exploration + preservation tests) run in parallel on UNFIXED code
- **Wave 1** tasks are independent implementation changes that can be done in parallel
- **Wave 2** tasks depend on Wave 1 (3.3 needs 3.2's guard logic; 3.6 needs 3.4's button; 3.7 needs 3.4 and 3.5 for CSS targets)
- **Wave 3** re-runs tests to confirm fix works and preserves behavior
- Property-based tests use `fast-check` (TS) and inline `#[cfg(test)]` tests (Rust)
- The actual overlay window (`OverlayRenderer.tsx`) is NOT modified — controller buttons in preview are purely visual placeholders
